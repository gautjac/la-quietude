#!/usr/bin/env node
'use strict';
/**
 * render-seances.cjs — build the pre-rendered séance catalogue.
 *
 * For each entry in catalog.config.cjs:
 *   1. generate a timed script with Opus (seance-gen.cjs)
 *   2. render ONE Edge-TTS MP3 clip per spoken line (tts-edge.cjs)
 *   3. probe each clip's exact duration with ffprobe
 *   4. write public/seances/<id>/{meta.json, 001.mp3, 002.mp3, …}
 * Then rebuild public/seances/index.json from every meta.json on disk.
 *
 * Idempotent: an entry whose meta.json already exists is skipped unless --force.
 *
 * Flags:
 *   --force            re-render everything (or the --only subset)
 *   --only a,b,c       render only these ids
 *   --limit N          render at most N (after filtering)
 *   --index-only       skip rendering; just rebuild index.json
 *   --concurrency N    parallel clip renders within a séance (default 4)
 *
 * Requires CLAUDE_API_KEY / ANTHROPIC_API_KEY (read from .env) and edge-tts +
 * ffprobe on PATH.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadEnv } = require('./lib/env.cjs');
const { generateSeance } = require('./lib/seance-gen.cjs');
const { generateAudioFromText } = require('./lib/tts-edge.cjs');
const { voiceFor, rateFor } = require('./lib/voices.cjs');
const { CATALOG } = require('./catalog.config.cjs');

loadEnv();

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'seances');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const FLAGS = {
  force: process.argv.includes('--force'),
  indexOnly: process.argv.includes('--index-only'),
  only: (arg('--only') || '').split(',').map((s) => s.trim()).filter(Boolean),
  limit: arg('--limit') ? parseInt(arg('--limit'), 10) : Infinity,
  concurrency: arg('--concurrency') ? parseInt(arg('--concurrency'), 10) : 4,
};

function probeDurationMs(file) {
  try {
    const out = execFileSync(
      'ffprobe',
      ['-v', 'quiet', '-of', 'csv=p=0', '-show_entries', 'format=duration', file],
      { encoding: 'utf8' }
    ).trim();
    const sec = parseFloat(out);
    if (Number.isFinite(sec) && sec > 0) return Math.round(sec * 1000);
  } catch {}
  return null;
}

async function mapLimited(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function withRetry(fn, tries, label) {
  let lastErr;
  for (let t = 1; t <= tries; t++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      console.warn(`   ↻ ${label} failed (try ${t}/${tries}): ${e.message}`);
      await new Promise((r) => setTimeout(r, 800 * t));
    }
  }
  throw lastErr;
}

async function renderEntry(entry) {
  const dir = path.join(OUT, entry.id);
  const dials = {
    length: entry.length,
    theme: entry.theme,
    register: entry.register,
    pacing: entry.pacing ?? 0,
  };
  const voice = voiceFor(entry.register, entry.lang);
  const rate = rateFor(entry.theme);

  console.log(`\n▶ ${entry.id}  (${voice} ${rate})`);
  console.log('   · generating script with Opus…');
  const seance = await withRetry(
    () => generateSeance(dials, entry.lang, 0),
    3,
    'script'
  );
  console.log(`   · "${seance.title}" — ${seance.lines.length} lines; voicing…`);

  fs.mkdirSync(dir, { recursive: true });

  const lines = await mapLimited(seance.lines, FLAGS.concurrency, async (line, idx) => {
    const clip = String(idx + 1).padStart(3, '0') + '.mp3';
    const file = path.join(dir, clip);
    await withRetry(
      () => generateAudioFromText(line.text, file, { voice, rate }),
      3,
      `clip ${clip}`
    );
    const durationMs = probeDurationMs(file);
    return { text: line.text, pauseAfterMs: line.pauseAfterMs, clip, durationMs };
  });

  const spokenMs = lines.reduce((s, l) => s + (l.durationMs || 0), 0);
  const silenceMs = lines.reduce((s, l) => s + l.pauseAfterMs, 0);

  const meta = {
    id: entry.id,
    title: seance.title,
    intention: seance.intention,
    theme: entry.theme,
    register: entry.register,
    length: entry.length,
    lang: entry.lang,
    pacing: dials.pacing,
    voice,
    rate,
    lines,
    spokenMs,
    silenceMs,
    totalMs: spokenMs + silenceMs,
    createdAt: Date.now(),
  };
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  console.log(
    `   ✓ ${entry.id} — ${lines.length} clips, ` +
      `${Math.round(meta.totalMs / 1000)}s total (${Math.round(spokenMs / 1000)}s voice)`
  );
  return meta;
}

function rebuildIndex() {
  const ids = fs
    .readdirSync(OUT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const entries = [];
  for (const id of ids) {
    const metaPath = path.join(OUT, id, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;
    const m = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    entries.push({
      id: m.id,
      title: m.title,
      intention: m.intention,
      theme: m.theme,
      register: m.register,
      length: m.length,
      lang: m.lang,
      voice: m.voice,
      lineCount: m.lines.length,
      totalMs: m.totalMs,
    });
  }
  // Keep the catalogue order from config where possible, then any extras.
  const order = new Map(CATALOG.map((e, i) => [e.id, i]));
  entries.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(entries, null, 2));
  console.log(`\n■ index.json rebuilt — ${entries.length} séances`);
  return entries;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  if (FLAGS.indexOnly) {
    rebuildIndex();
    return;
  }

  let todo = CATALOG;
  if (FLAGS.only.length) todo = todo.filter((e) => FLAGS.only.includes(e.id));
  if (!FLAGS.force) {
    todo = todo.filter((e) => !fs.existsSync(path.join(OUT, e.id, 'meta.json')));
  }
  todo = todo.slice(0, FLAGS.limit);

  if (todo.length === 0) {
    console.log('Nothing to render (all present; use --force to re-render).');
  } else {
    console.log(`Rendering ${todo.length} séance(s)…`);
  }

  let ok = 0;
  const failed = [];
  for (const entry of todo) {
    try {
      await renderEntry(entry);
      ok++;
    } catch (e) {
      console.error(`   ✗ ${entry.id} FAILED: ${e.message}`);
      failed.push(entry.id);
    }
  }

  rebuildIndex();
  console.log(`\nDone: ${ok} rendered, ${failed.length} failed.`);
  if (failed.length) {
    console.log(`Failed ids: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

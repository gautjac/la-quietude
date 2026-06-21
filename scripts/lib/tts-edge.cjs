#!/usr/bin/env node
/**
 * tts-edge.cjs — Edge-TTS adapter for La Quiétude.
 *
 * This is the SAME flow the podcast-summaries app uses (scripts/tts-edge.cjs
 * there): Microsoft's free Edge browser neural voices via the Python `edge-tts`
 * CLI. No key, no quota, CPU-only, comparable quality to commercial TTS.
 *
 *   pipx install edge-tts        # local
 *   pip install edge-tts         # CI
 *
 * La Quiétude renders ONE clip per spoken line (not one long file), because the
 * silences between lines are held by the player, not baked into the audio. So
 * Edge-TTS's lack of SSML <break/> support is irrelevant here: each clip is a
 * single calm sentence, and the timed silence lives between clips.
 *
 * Meditation defaults are slower than the podcast app's (-8% vs -3%); callers
 * pass an explicit rate per theme (sleep/grief slowest).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

const DEFAULT_VOICE = process.env.EDGE_TTS_VOICE || 'fr-CA-SylvieNeural';
const DEFAULT_RATE = process.env.EDGE_TTS_RATE || '-8%';
const DEFAULT_PITCH = process.env.EDGE_TTS_PITCH || '+0Hz';
const DEFAULT_VOLUME = process.env.EDGE_TTS_VOLUME || '+0%';

function findEdgeTts() {
  if (process.env.EDGE_TTS_BIN) return process.env.EDGE_TTS_BIN;
  try {
    return execSync('command -v edge-tts', { encoding: 'utf8' }).trim();
  } catch {}
  const candidates = [
    path.join(process.env.HOME || '', '.local/bin/edge-tts'),
    '/opt/homebrew/bin/edge-tts',
    '/usr/local/bin/edge-tts',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('edge-tts not found. Install with: pipx install edge-tts');
}

/**
 * Render one line of text to an MP3 at outputPath.
 * options: { voice, rate, pitch, volume } — all strings, Edge-TTS syntax.
 * Resolves { bytes, voice, rate } on success.
 */
async function generateAudioFromText(text, outputPath, options = {}) {
  const bin = findEdgeTts();
  const voice = options.voice || DEFAULT_VOICE;
  const rate = options.rate || DEFAULT_RATE;
  const pitch = options.pitch || DEFAULT_PITCH;
  const volume = options.volume || DEFAULT_VOLUME;

  const tmpPath = path.join(
    os.tmpdir(),
    `quietude-tts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`
  );
  fs.writeFileSync(tmpPath, text, 'utf8');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  return new Promise((resolve, reject) => {
    // `--flag=value` syntax so argparse never mistakes a value starting with
    // '-' (like '-8%') for another flag.
    const args = [
      '-f', tmpPath,
      `--voice=${voice}`,
      `--rate=${rate}`,
      `--pitch=${pitch}`,
      `--volume=${volume}`,
      '--write-media', outputPath,
    ];
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => {
      try { fs.unlinkSync(tmpPath); } catch {}
      reject(new Error(`Failed to spawn edge-tts: ${err.message}`));
    });
    proc.on('exit', (code) => {
      try { fs.unlinkSync(tmpPath); } catch {}
      if (code !== 0) {
        return reject(new Error(`edge-tts exited ${code}: ${stderr.trim().slice(0, 400)}`));
      }
      try {
        const stat = fs.statSync(outputPath);
        if (stat.size < 1200) {
          return reject(new Error(`edge-tts produced a suspiciously small file (${stat.size} bytes). stderr: ${stderr.slice(0, 200)}`));
        }
        resolve({ bytes: stat.size, voice, rate });
      } catch (err) {
        reject(err);
      }
    });
  });
}

module.exports = { generateAudioFromText, findEdgeTts, DEFAULT_VOICE, DEFAULT_RATE };

// CLI: node scripts/lib/tts-edge.cjs "text" /tmp/out.mp3 [voice] [rate]
if (require.main === module) {
  const [, , text, out, voice, rate] = process.argv;
  if (!text || !out) {
    console.error('Usage: node scripts/lib/tts-edge.cjs "text" /path/out.mp3 [voice] [rate]');
    process.exit(1);
  }
  generateAudioFromText(text, out, { voice, rate })
    .then((info) => console.log(JSON.stringify({ ok: true, ...info })))
    .catch((err) => { console.error(err.message); process.exit(1); });
}

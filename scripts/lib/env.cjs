'use strict';
// Minimal .env loader (no dotenv dependency). Reads KEY=VALUE lines from the
// project's .env into process.env if not already set. Quiet on missing file.
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  const p = file || path.join(__dirname, '..', '..', '.env');
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); } catch { return; }
  for (const line of raw.split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i < 0) continue;
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

module.exports = { loadEnv };

'use strict';
/**
 * Preload hook (Node only): merge `.velo/connector-env.json` into `process.env`
 * for keys that are still empty — same idea as `applyStoredConnectorEnvAtStartup`
 * in `connector-env-store.ts`, without pulling `fs` through Next/Webpack.
 *
 * Use: node -r ./lib/register-env.cjs …/next dev|start
 *
 * Only ALL_CAPS keys are applied (defensive). Host env wins when already set.
 */
const fs = require('fs');
const path = require('path');

function applyConnectorEnvFromFile() {
  const root = process.env.VELO_DATA_DIR || path.join(process.cwd(), '.velo');
  const file = path.join(root, 'connector-env.json');
  if (!fs.existsSync(file)) return;
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return;
  }
  if (!data || typeof data !== 'object') return;
  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== 'string' || !v.trim()) continue;
    if (!/^[A-Z][A-Z0-9_]*$/.test(k)) continue;
    if (process.env[k]?.trim()) continue;
    process.env[k] = v;
  }
}

applyConnectorEnvFromFile();

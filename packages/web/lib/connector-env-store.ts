import 'server-only';

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { veloDataDir } from './velo-data-dir';
import { allAllowedConnectorKeys } from './connectors-catalog';

const ALLOWED = new Set(allAllowedConnectorKeys());

let startupApplyDone = false;

export function connectorEnvPath(): string {
  return join(veloDataDir(), 'connector-env.json');
}

function readRaw(): Record<string, string> {
  const p = connectorEnvPath();
  if (!existsSync(p)) return {};
  try {
    const o = JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) {
      if (ALLOWED.has(k) && typeof v === 'string' && v.trim() !== '') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Values saved in `.velo/connector-env.json` (gitignored). */
export function getStoredConnectorEnv(): Record<string, string> {
  return readRaw();
}

export type KeySource = 'none' | 'process' | 'file' | 'both';

export function keyStatus(
  key: string,
  stored: Record<string, string>
): {
  envSet: boolean;
  fileSet: boolean;
  effectiveSet: boolean;
  source: KeySource;
} {
  const envSet = Boolean(process.env[key]?.trim());
  const fileSet = Boolean(stored[key]?.trim());
  let source: KeySource = 'none';
  if (envSet && fileSet) source = 'both';
  else if (envSet) source = 'process';
  else if (fileSet) source = 'file';
  const effectiveSet = envSet || fileSet;
  return { envSet, fileSet, effectiveSet, source };
}

/**
 * On server boot: fill process.env from file only where env is empty.
 * Host / .env.local wins for the same key.
 */
export function applyStoredConnectorEnvAtStartup(): void {
  if (startupApplyDone) return;
  startupApplyDone = true;
  const stored = readRaw();
  for (const [k, v] of Object.entries(stored)) {
    if (!process.env[k]?.trim() && v) process.env[k] = v;
  }
}

/**
 * After user saves from Settings: merge patch into file, then set process.env for
 * keys that now have a value so the running server picks up changes without restart.
 * Clearing a field removes it from the file only (does not unset host env).
 */
export function patchStoredConnectorEnv(
  patch: Record<string, string | undefined | null>
): Record<string, string> {
  const next = readRaw();
  for (const [k, raw] of Object.entries(patch)) {
    if (!ALLOWED.has(k)) continue;
    const v = raw === undefined || raw === null ? '' : String(raw);
    if (!v.trim()) delete next[k];
    else next[k] = v;
  }
  writeFileSync(connectorEnvPath(), JSON.stringify(next, null, 2), 'utf-8');
  for (const [k, v] of Object.entries(next)) {
    if (v.trim()) process.env[k] = v;
  }
  return next;
}

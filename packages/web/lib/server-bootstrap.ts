import 'server-only';

import { applyStoredConnectorEnvAtStartup } from './connector-env-store';

/** Call from the root Server Layout only — loads `.velo/connector-env.json` into `process.env` (empty slots). */
export function ensureConnectorEnvLoaded(): void {
  applyStoredConnectorEnvAtStartup();
}

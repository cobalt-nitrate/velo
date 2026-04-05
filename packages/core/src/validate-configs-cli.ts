#!/usr/bin/env npx tsx
import { validateAllVeloConfigs } from './config/loader.js';

const { ok, errors } = validateAllVeloConfigs();
if (!ok) {
  console.error('Config validation failed:\n');
  for (const line of errors) console.error(' ', line);
  process.exit(1);
}
console.log('All Velo configs validated OK.');

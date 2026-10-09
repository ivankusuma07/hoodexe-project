#!/usr/bin/env node
/**
 * Runs an indexer command natively on Linux/macOS, and inside the compose `indexer` container on Windows,
 * where envio has no build (its CLI and test runtime are native binaries).
 *
 *   node scripts/envio.mjs codegen        envio codegen (types for config.yaml + schema.graphql)
 *   node scripts/envio.mjs test           vitest run
 *   node scripts/envio.mjs ensure-types   codegen only if .envio/types.d.ts is missing (before tsc)
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(dirname(fileURLToPath(import.meta.url)));
const commands = { codegen: ['npx', 'envio', 'codegen'], test: ['npx', 'vitest', 'run'] };

function run(args) {
  const native = process.platform !== 'win32';
  const [cmd, ...rest] = native
    ? args
    : ['docker', 'compose', '--profile', 'indexer', 'run', '--rm', '--no-deps', '--build', 'indexer', ...args];
  const result = spawnSync(cmd, rest, { cwd: native ? here : join(here, '..', '..'), stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) {
    console.error(native ? result.error.message : `Docker is needed to run envio on Windows: ${result.error.message}`);
    process.exit(1);
  }
  process.exit(result.status ?? 1);
}

const task = process.argv[2];
if (task === 'ensure-types') {
  if (existsSync(join(here, '.envio', 'types.d.ts'))) process.exit(0);
  run(commands.codegen);
} else if (task in commands) {
  run(commands[task]);
} else {
  console.error(`Unknown task "${task}". Use codegen, test or ensure-types.`);
  process.exit(1);
}

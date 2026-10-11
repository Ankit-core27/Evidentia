import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const directory = await mkdtemp(join(tmpdir(), 'evidentia-anatomy-test-'));
try {
  const outfile = join(directory, 'tests.mjs');
  await build({ entryPoints: ['src/features/anatomy/anatomy.test.ts'], outfile, bundle: true, platform: 'node', format: 'esm', logLevel: 'warning' });
  process.exitCode = spawnSync(process.execPath, ['--test', outfile], { stdio: 'inherit' }).status ?? 1;
} finally { await rm(directory, { recursive: true, force: true }); }

// Runs the building dissection tests against the generated GLB files. Run from frontend/:
// npm run test:buildings
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const directory = await mkdtemp(join(tmpdir(), 'forensix-buildings-test-'));
try {
  const outfile = join(directory, 'tests.mjs');
  await build({
    entryPoints: ['src/features/building-viewer/dissection.test.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'warning',
    alias: { '@': resolve('src') },
    // The test reads the models relative to its source file, not the bundle.
    define: { 'import.meta.url': JSON.stringify(`file://${resolve('src/features/building-viewer/dissection.test.ts')}`) }
  });
  process.exitCode = spawnSync(process.execPath, ['--test', outfile], { stdio: 'inherit' }).status ?? 1;
} finally { await rm(directory, { recursive: true, force: true }); }

// Publish one visually accepted manifest, then verify resources and grouping.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mapTool } from './mcp_maps_client.mjs';
const run = promisify(execFile);
const code = process.argv[2];
if (!/^MT1-\d{3}$/.test(code || '')) throw new Error('One source code required');
const root = path.resolve(import.meta.dirname, '../..');
const base = path.join(root, 'models/collections/medieval-town-vol1');
const upload = path.join(base, 'upload', code);
const manifest = JSON.parse(await fs.readFile(path.join(upload, 'catalogue.json'), 'utf8'));
assert.equal(manifest.length, 1);
const expected = manifest[0];
const { stderr } = await run('go', ['run', './cmd/map-model-upload', '-assets', upload, '-workers', '1'], { cwd: root, maxBuffer: 1048576 });
if (stderr) process.stdout.write(stderr);
const current = await mapTool('map_tile_model_get', { id: expected.id });
assert.equal(current.definitionId, expected.definitionId);
if (current.code!==expected.code) {
  await mapTool('map_tile_model_group_update', { definitionId: current.definitionId, expectedCode: current.code, code: expected.code });
}
const registry = await mapTool('map_tile_models_list');
assert.deepEqual(registry.find(m => m.id===expected.id), expected, 'Published metadata or assets differ');
await fs.writeFile(path.join(base, 'registry-snapshot.json'), JSON.stringify(registry, null, 2)+'\n', { mode: 0o600 });
const confirmed = await run('node', ['scripts/maps/record-medieval.mjs', code], { cwd: root });
process.stdout.write(confirmed.stdout);

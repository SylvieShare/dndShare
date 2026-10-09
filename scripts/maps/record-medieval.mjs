// Only a fresh MCP snapshot can confirm the publication of a reviewed model.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
const base = path.resolve(import.meta.dirname, '../../models/collections/medieval-town-vol1');
const code = process.argv[2];
if (!/^MT1-\d{3}$/.test(code || '')) throw new Error('One source code required');
const manifest = JSON.parse(await fs.readFile(path.join(base, 'upload', code, 'catalogue.json'), 'utf8'));
assert.equal(manifest.length, 1);
const model = manifest[0];
assert.equal(model.collection, 'medieval-town-vol1');
assert.equal(model.textureDetail, 'detailed');
const registry = JSON.parse(await fs.readFile(path.join(base, 'registry-snapshot.json'), 'utf8'));
assert.deepEqual(registry.find(m => m.id===model.id), model, 'Refresh MCP snapshot and compare all five assets and placement');
const file = path.join(base, 'review', code, 'report.json');
const report = JSON.parse(await fs.readFile(file, 'utf8'));
assert.deepEqual(report.model, model);
report.publication = { confirmedAt: new Date().toISOString(), uuid: model.id, definitionId: model.definitionId,
  assetsVerified: true, placementVerified: true };
await fs.writeFile(file, JSON.stringify(report, null, 2)+'\n');
const inventory = JSON.parse(await fs.readFile(path.join(base, 'inventory.json'), 'utf8'));
const progress = [];
for (const row of inventory) {
  const r = JSON.parse(await fs.readFile(path.join(base, 'review', row.code, 'report.json'), 'utf8').catch(() => '{}'));
  const current = registry.find(m => m.collection===row.collection && m.sourceCode===row.code);
  const published = current && r.publication?.assetsVerified && isDeepStrictEqual(r.model, current);
  progress.push({ code: row.code, sourceName: row.sourceName, status: published ? 'published' : 'pending', uuid: published ? current.id : null });
}
await fs.writeFile(path.join(base, 'progress.json'), JSON.stringify(progress, null, 2)+'\n');
console.log('MEDIEVAL_CONFIRMED', code, model.id, Object.fromEntries(Object.entries(model.assets).map(([k,a]) => [k,a.size])));
console.log('MEDIEVAL_PROGRESS', progress.filter(p => p.status==='published').length, '/', progress.length);

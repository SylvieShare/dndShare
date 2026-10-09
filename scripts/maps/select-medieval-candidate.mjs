// Accept one visually checked texture candidate, preserving the model identity.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const code = process.argv.find(a => a.startsWith('--code='))?.slice(7);
const candidate = process.argv.find(a => a.startsWith('--candidate='))?.slice(12);
const reason = process.argv.find(a => a.startsWith('--reason='))?.slice(9);
if (!/^MT1-\d{3}$/.test(code || '') || candidate!=='compact' || !reason?.trim()) throw new Error('Reviewed model, compact candidate and visual selection reason required');
const directory = path.resolve(import.meta.dirname, '../../models/collections/medieval-town-vol1/review', code);
const source = path.join(directory, 'candidates', candidate);
const baseline = JSON.parse(await fs.readFile(path.join(directory, 'report.json'), 'utf8'));
const selected = JSON.parse(await fs.readFile(path.join(source, 'report.json'), 'utf8'));
assert.equal(selected.sourceSHA256, baseline.sourceSHA256);
assert.deepEqual(selected.recipe, baseline.recipe);
const { id: baselineID, assets: baselineAssets, ...baselineMetadata } = baseline.model;
const { id: selectedID, assets: selectedAssets, ...selectedMetadata } = selected.model;
assert.deepEqual(selectedMetadata, baselineMetadata);
for (const tier of ['render', 'lod', 'shadow']) {
  assert.equal(selected.tiers[tier].triangles, baseline.tiers[tier].triangles);
  assert.deepEqual(selected.tiers[tier].bounds, baseline.tiers[tier].bounds);
}
for (const file of ['render.glb', 'lod.glb', 'shadow.glb', 'preview-model.glb', 'lod-preview-model.glb', 'preview.png', 'reverse.png', 'top.png']) {
  await fs.copyFile(path.join(source, file), path.join(directory, file));
}
selected.model = { ...selected.model, ...(baselineID ? { id: baselineID } : {}) };
selected.publication = null;
selected.optimization = { candidate, selection: reason.trim(), baselineTiers: baseline.tiers,
  savedBytes: ['render','lod'].reduce((sum,t) => sum+baseline.tiers[t].bytes-selected.tiers[t].bytes, 0) };
await fs.writeFile(path.join(directory, 'report.json'), JSON.stringify(selected, null, 2)+'\n');
console.log('MEDIEVAL_SELECTED', code, candidate, selected.optimization.savedBytes);

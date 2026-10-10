// A measured surface metadata correction must preserve every other field/asset.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const code = process.argv[2];
assert.match(code || '', /^MT1-\d{3}$/);
const base = path.resolve(import.meta.dirname, '../../models/collections/medieval-town-vol1');
const report = JSON.parse(await fs.readFile(path.join(base, 'review', code, 'report.json'), 'utf8'));
const registry = JSON.parse(await fs.readFile(path.join(base, 'registry-before-'+code+'-surface.json'), 'utf8'));
const old = registry.find(m => m.id===report.model.id);
assert.ok(old);
const { surfaceHeight: oldHeight, ...oldRest } = old;
const { surfaceHeight: newHeight, ...newRest } = report.model;
assert.deepEqual(newRest, oldRest, 'Surface correction changed geometry assets, identity or other placement metadata');
assert.notEqual(newHeight, oldHeight);
const probe = report.surfaceHeightProbeMM;
assert.ok(probe?.position?.length===2 && [probe.source,probe.render,probe.lod].every(Number.isFinite));
assert.equal(newHeight, Number((probe.render/35).toFixed(6)));
for (const value of [probe.render,probe.lod]) assert.ok(Math.abs(value-probe.source)<report.recipe.standToleranceMM);
report.surfaceHeightCorrection = { previous: oldHeight, measured: newHeight,
  unchangedAssetsAndOtherMetadata: true, reason: 'Occupied tile has no character stand point; main paving height is independently measured instead of using the insertion datum.' };
await fs.writeFile(path.join(base, 'review', code, 'report.json'), JSON.stringify(report, null, 2)+'\n');
console.log('MEDIEVAL_SURFACE_CORRECTION_VALIDATED', code, oldHeight, newHeight);

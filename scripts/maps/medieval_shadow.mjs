import fs from 'node:fs/promises';
import path from 'node:path';
import { prepareShadow } from './shadow_model.mjs';

// A lit torch may use its measured unlit counterpart for opaque shadows.
// Keep this in the recipe so rebuilding a colour candidate cannot restore fire.
export async function prepareMedievalShadow(base, review, recipe, model) {
  const reference = recipe.shadowReference;
  let source = path.join(review, 'lod.glb');
  if (reference) {
    if (!/^MT1-\d{3}$/.test(reference.code) || reference.code === model.sourceCode)
      throw new Error('Invalid opaque shadow reference');
    const directory = path.join(base, 'review', reference.code);
    const report = JSON.parse(await fs.readFile(path.join(directory, 'report.json'), 'utf8'));
    if (report.sourceSHA256 !== reference.sourceSHA256)
      throw new Error('Opaque shadow reference source changed; review it again');
    for (const key of ['width', 'height', 'mountDepth', 'placementOffset']) {
      if (JSON.stringify(report.model[key]) !== JSON.stringify(model[key]))
        throw new Error('Opaque shadow reference frame differs: ' + key);
    }
    source = path.join(directory, 'lod.glb');
  }
  const result = await prepareShadow(source, path.join(review, 'shadow.glb'));
  return { ...result, ...(reference ? { reference } : {}) };
}

// Merge recipe-owned light keys and transitions without discarding other edits.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { mapTool } from './mcp_maps_client.mjs';

export async function applyBehaviour(definitionId, recipe) {
  if (!Array.isArray(recipe.defaultLights) && !recipe.transitions?.length) return null;
  const managed = new Set(recipe.materials.kind==='torch' ? ['torch-flame'] : (recipe.defaultLights || []).map(l => l.key));
  for (let attempt = 0; attempt<3; attempt++) {
    const current = (await mapTool('map_tile_model_behaviour_get', { definitionId })).behaviour;
    const lights = [...current.defaultLights.filter(l => !managed.has(l.key)), ...(recipe.defaultLights || [])];
    const transitions = [...current.transitions];
    for (const desired of recipe.transitions || []) {
      if (!transitions.some(t => t.toDefinitionId===desired.toDefinitionId && t.action===desired.action)) {
        transitions.push({ id: randomUUID(), ...desired });
      }
    }
    transitions.sort((a,b) => a.action.localeCompare(b.action) || a.id.localeCompare(b.id));
    if (!isDeepStrictEqual(lights, current.defaultLights) || !isDeepStrictEqual(transitions, current.transitions)) {
      try {
        await mapTool('map_tile_model_behaviour_update', { definitionId, behaviour: { ...current, defaultLights: lights, transitions } });
      } catch (error) {
        if (attempt<2 && /revision|конфликт|устар|409/i.test(error.message)) continue;
        throw error;
      }
    }
    const verified = (await mapTool('map_tile_model_behaviour_get', { definitionId })).behaviour;
    assert.deepEqual(verified.defaultLights, lights);
    assert.deepEqual(verified.transitions, transitions);
    return { confirmedAt: new Date().toISOString(), definitionId, ...verified };
  }
  throw new Error('Concurrent behaviour edit prevented verification');
}

if (process.argv[1]===import.meta.filename) {
  const code = process.argv[2];
  if (!/^MT1-\d{3}$/.test(code || '')) throw new Error('One source code required');
  const recipe = JSON.parse(await fs.readFile(path.join(import.meta.dirname, 'medieval-recipes', code+'.json'), 'utf8'));
  const verified = await applyBehaviour(code, recipe);
  const reportPath = path.resolve(import.meta.dirname, '../../models/collections/medieval-town-vol1/review', code, 'report.json');
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  report.behaviourPublication = verified;
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2)+'\n');
  console.log('MEDIEVAL_BEHAVIOUR_CONFIRMED', code, verified?.revision, verified?.defaultLights.length, verified?.transitions.length);
}

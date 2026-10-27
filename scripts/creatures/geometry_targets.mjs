import assert from 'node:assert/strict';

export function geometryTargets(recipe = {}) {
  return Object.fromEntries(['render', 'lod', 'shadow'].map(role => {
    const target = recipe.build?.[`${role}Triangles`] ?? null;
    assert.ok(target === null || (Number.isSafeInteger(target) && target > 0),
      `${role} triangle target must be a positive integer`);
    return [role, target];
  }));
}

import assert from 'node:assert/strict';

// Rare complex silhouettes may need more geometry than the default 25k.
export function lodTriangleLimit(recipe = {}) {
  const budget = recipe.lodBudget;
  if (budget == null) return 25000;
  assert.ok(Number.isInteger(budget.maxTriangles) && budget.maxTriangles > 25000 && budget.maxTriangles <= 44000,
    'LOD override must be an explicit 25k..44k triangle budget');
  assert.ok(typeof budget.reason === 'string' && budget.reason.trim(), 'LOD override needs an art-quality reason');
  assert.deepEqual(Object.keys(budget).sort(), ['maxTriangles', 'reason'], 'Unknown LOD budget setting');
  return budget.maxTriangles;
}

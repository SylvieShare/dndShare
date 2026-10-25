import assert from 'node:assert/strict';
import test from 'node:test';
import {lodTriangleLimit} from './lod_budget.mjs';

test('LOD stays at 25k unless an author records a bounded, explained exception', () => {
  assert.equal(lodTriangleLimit(), 25000);
  assert.equal(lodTriangleLimit({lodBudget:{maxTriangles:32000,reason:'Preserve broad feather vanes'}}), 32000);
  for (const budget of [
    {maxTriangles:32000}, {maxTriangles:32000,reason:'  '},
    {maxTriangles:25000,reason:'No exception'}, {maxTriangles:44001,reason:'Too high'},
    {maxTriangles:32000.5,reason:'Fraction'}, {maxTriangles:'32000',reason:'Wrong type'},
    {maxTriangles:32000,reason:'Extra field',automatic:true},
  ]) assert.throws(() => lodTriangleLimit({lodBudget:budget}));
});

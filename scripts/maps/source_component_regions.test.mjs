import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSourceComponent } from './source_component_regions.mjs';

const a = [[0,0,2],[1,0,2],[0,1,2]];
const b1 = [[10,0,2],[11,0,2],[10,1,2]];
const b2 = [[11,0,2],[11,1,2],[10,1,2]];
const bridgeA = [a[0],[5,0,0],[5,1,0]];
const bridgeB = [b1[0],[5,0,0],[5,1,0]];
const source = (...triangles) => Float32Array.from(triangles.flat(2));

test('a lower bridge does not merge separately connected upper surfaces', () => {
  const selected = selectSourceComponent(source(a,b1,b2,bridgeA,bridgeB),1);
  assert.deepEqual(selected.counts,[4,3]);
  assert.equal(selected.components,2);
  assert.equal(selected.triangles,3);
  assert.deepEqual(Array.from(selected.positions),Array.from(source(b1,b2,bridgeB)));
  assert.deepEqual(Array.from(selectSourceComponent(source(a,b1,b2,bridgeA,bridgeB),1,1).positions),Array.from(source(a,bridgeA)));
});

test('ranking uses welded vertices and survives STL triangle reordering', () => {
  const selected = selectSourceComponent(source(bridgeB,b2,a,bridgeA,b1),1);
  assert.deepEqual(selected.counts,[4,3]);
  assert.equal(selected.vertices,4);
  for (let i=0;i<selected.positions.length;i+=3) {
    if (selected.positions[i+2]>1) assert.ok(selected.positions[i]>=10);
  }
});

test('a long face touching the selected upper part remains whole across the height', () => {
  const selected=selectSourceComponent(source(b1,b2,bridgeB),1);
  assert.equal(selected.triangles,3);
  assert.ok(Array.from(selected.positions).some((v,i)=>i%3===2&&v===0));
  assert.deepEqual(Array.from(selected.positions.slice(-9)),Array.from(source(bridgeB)));
});

test('invalid or empty selections fail instead of falling back to the whole source', () => {
  assert.throws(()=>selectSourceComponent(source(a),NaN));
  assert.throws(()=>selectSourceComponent(source(a),1,-1));
  assert.throws(()=>selectSourceComponent(source(a),1,1));
  assert.throws(()=>selectSourceComponent(source(a),3));
  assert.throws(()=>selectSourceComponent(new Float32Array(4),1));
});

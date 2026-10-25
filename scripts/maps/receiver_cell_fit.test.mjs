import test from "node:test";
import assert from "node:assert/strict";
import { fitReceiverGeometry } from "./receiver_cell_fit.mjs";
import { receiverCells, socketProbeCellSamples } from "./receiver_cells.mjs";
import { sourceSocketProbes } from "./receiver_geometry.mjs";

const cells = receiverCells({ width: 2, height: 1, supportSlots: [{ x: 0, y: 0, width: 2, height: 1 }] });
function plane(cx, z) {
  return [[-13,-13,z],[13,-13,z],[13,13,z],[-13,-13,z],[13,13,z],[-13,13,z]].flatMap(p => [p[0]+cx,p[1],p[2]]);
}
test("each receiving cell and rotation uses its own limiting height", () => {
  const frame = Float32Array.from([...plane(-17.5,20),...plane(17.5,22)]);
  const lower = Float32Array.from([[-14,-14,10],[14,14,10],[14,-14,10],[-14,-14,10],[-14,14,10],[14,14,10]].flat());
  const rows = fitReceiverGeometry(frame,[{profile:"ordinary",lower}],cells);
  assert.equal(rows.length,8);
  for (const cell of cells) for (const angle of [0,90,180,270]) {
    const row = rows.find(r => r.x===cell.x && r.rotation===angle);
    assert.equal(row.minimumSeatMM,cell.x===0?27:29);
    assert.ok(Math.abs(row.verifiedSeatMM-row.minimumSeatMM-.02)<1e-10);
  }
  assert.throws(() => fitReceiverGeometry(frame,[{profile:"ordinary",lower}],[{x:2,y:0,centerMM:[100,0]}]),/No measured receiving contact/);
});

test("socket rays start above each cell floor and retain cell provenance", () => {
  const source = Float32Array.from([...plane(-17.5,10),...plane(17.5,12),33,0,14,34,0,14,33,1,14]);
  const probes=sourceSocketProbes(source,{min:[-35,-17.5,0],max:[35,17.5,14]},cells);
  const counts=socketProbeCellSamples(probes,cells);
  assert.ok(counts["0,0"]>counts["1,0"] && counts["1,0"]>=100);
  for (const c of cells) {
    const own=probes.filter(p=>p.cell.x===c.x);
    const horizontal=own.filter(p=>p.direction[2]===0);
    assert.equal(Math.min(...horizontal.map(p=>p.origin[2])),c.x===0?10.5:12.5);
    assert.ok(own.every(p=>Math.abs(p.origin[0]-c.centerMM[0])<=12));
    assert.ok(own.filter(p=>p.direction[2]===-1).every(p=>Math.abs(p.point[2]-(c.x===0?10:12))<1e-6));
  }
  assert.throws(()=>socketProbeCellSamples(probes.filter(p=>p.cell.x===0),cells),/Every receiving cell/);
  assert.throws(()=>receiverCells({width:2,height:1,supportSlots:[{x:0,y:0,width:2,height:1},{x:1,y:0,width:1,height:1}]}),/Overlapping/);
});

test("asymmetric lower surfaces produce different seats after cardinal rotation", () => {
  const triangle=(cx,z)=>[cx+1,1,z,cx+3,1,z,cx+1,4,z];
  const frame=Float32Array.from([...triangle(-17.5,20),...triangle(17.5,22)]);
  const lower=Float32Array.from([[-14,-14],[14,14],[14,-14],[-14,-14],[-14,14],[14,14]].flatMap(([x,y])=>[x,y,10+.5*x]));
  const rows=fitReceiverGeometry(frame,[{profile:"sloped",lower}],cells);
  const expected={0:26.5,90:26.5,180:28.5,270:29};
  for(const row of rows)assert.ok(Math.abs(row.minimumSeatMM-expected[row.rotation]-row.x*2)<1e-6);
});

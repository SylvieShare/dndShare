import { expect, it } from "vitest";
import { tokenPlacementPoints, imageTokenPoint, unoccupiedObjectPoints } from "./tokenPlacement";
import { resolvedSurfacePosition, surfacePoints } from "./surfacePlacement";
import { tokenBounds, tokenPlacementIssue } from "./tokenFootprint";

function scene() {
  const model = { id: "floor", width: 1, height: 1, canStand: true, mountDepth: 0,
    placementPoints: [{ x: .3, y: .6, elevation: .4, cell: { x: 0, y: 0 } }], supportSlots: [] };
  const document = { kind: "tiles", width: 5, height: 5, objects: [], tiles:
    [0,1].flatMap(y => [0,1].map(x => ({ id:`${x}-${y}`,modelId:"floor",x,y,level:0,rotation:0 }))) };
  const token = { id: "ogre", kind: "creature", size: 2 };
  return { model, document, token, catalogue: [model] };
}

it("centres a 2×2 footprint across four distinct tiles, including a rotated and reflected anchor", () => {
  const s = scene();
  s.document.tiles[0].rotation = 90;
  s.document.tiles[0].mirrored = true;
  const at = tokenPlacementPoints(s.document, s.catalogue, s.token, { tokens: [] }).find(p => p.cell.x===0 && p.cell.y===0);
  expect(at).toMatchObject({ x:1, y:1, elevation:.4, invalidSurface:false });
  const posed = resolvedSurfacePosition({ ...s.token, ...at }, s.document, s.catalogue);
  expect(posed.x).toBeCloseTo(1); expect(posed.y).toBeCloseTo(1);
  expect(tokenBounds(posed)).toEqual({ x:0,y:0,width:2,height:2 });
  const derived = resolvedSurfacePosition({ ...s.token,placement:at.placement },s.document,s.catalogue);
  expect(derived.x).toBeCloseTo(1);expect(derived.y).toBeCloseTo(1);
});

it("requires every occupied cell to have free support at the same elevation", () => {
  const s = scene();
  s.document.tiles.pop();
  expect(tokenPlacementPoints(s.document,s.catalogue,s.token,{tokens:[]})[0].invalidReason).toMatch(/опора/);
  const t = scene();
  const raised = { ...t.model, id: "raised", placementPoints: [{ ...t.model.placementPoints[0], elevation:.7 }] };
  t.document.tiles[3].modelId = "raised";
  expect(tokenPlacementPoints(t.document,[...t.catalogue,raised],t.token,{tokens:[]})[0].invalidSurface).toBe(true);
});

it("rejects overlap with any part of a creature, ignores self and markers, and allows another floor", () => {
  const s = scene();
  const other = { id:"hero",kind:"player",size:1,x:1.5,y:1.5,elevation:.4,hidden:true,physical:true };
  const first = tokens => tokenPlacementPoints(s.document,s.catalogue,s.token,{tokens})[0];
  expect(first([other]).invalidReason).toMatch(/заняты/);
  expect(first([{ ...other,kind:"marker" }]).invalidSurface).toBe(false);
  expect(first([{ ...other,elevation:1.4 }]).invalidSurface).toBe(false);
  expect(first([{ ...s.token,x:1,y:1,elevation:.4 }]).invalidSurface).toBe(false);
});

it("snaps even footprints to intersections and odd footprints to cell centres on image maps", () => {
  const document = { kind:"image",width:8,height:8 };
  const token = { id:"ogre",kind:"creature",size:2 };
  expect(imageTokenPoint({x:2.2,y:3.3},token,document,{tokens:[]})).toMatchObject({x:2,y:3,invalidSurface:false});
  expect(imageTokenPoint({x:2.2,y:3.3},{...token,size:3},document,{tokens:[]})).toMatchObject({x:2.5,y:3.5});
  expect(imageTokenPoint({x:.1,y:.1},token,document,{tokens:[]}).invalidReason).toMatch(/границы/);
  expect(imageTokenPoint({x:2.2,y:3.3},token,document,{tokens:[{id:"hero",kind:"player",size:1,x:2.5,y:3.5}]}).invalidReason).toMatch(/заняты/);
});

it("uses the anchor's gameplay cell even when its physical point is in a different cell", () => {
  const s=scene();s.model.width=2;s.model.placementPoints[0].cell={x:1,y:0};
  s.document.tiles=s.document.tiles.slice(0,1);
  const npc=resolvedSurfacePosition({id:"npc",kind:"creature",size:1,placement:{tileId:"0-0",point:0}},s.document,s.catalogue);
  expect(tokenBounds(npc)).toMatchObject({x:1,y:0});
  expect(tokenPlacementIssue({id:"hero",kind:"player",size:1,x:1.5,y:.5,elevation:.4},s.document,[npc])).toMatch(/заняты/);
});

it("keeps occupied creature cells out of the shared object placement points", () => {
  const s=scene(), points=surfacePoints(s.document,s.catalogue);
  const token={...s.token,placement:{tileId:"0-0",point:0}};
  expect(unoccupiedObjectPoints(s.document,s.catalogue,{tokens:[token]},points)).toHaveLength(0);
  expect(unoccupiedObjectPoints(s.document,s.catalogue,{tokens:[{...token,kind:"marker"}]},points)).toHaveLength(4);
});

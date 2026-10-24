import { expect, it } from "vitest";
import { normalizeSessionMap } from "./sessionMapState";
import { newMap, initialState } from "./mapModel";
it("scene edits move attached creatures and prune removed links without changing surviving HP references", () => {
  const map = newMap();
  map.state = initialState();
  const model = {
    id: "floor",
    width: 1,
    height: 1,
    mountDepth: 0,
    surfaceHeight: 0.4,
    placementPoints: [{ cell: { x: 0, y: 0 }, x: 0.5, y: 0.5, elevation: 0.4 }],
    supportSlots: [],
    canStand: true,
  };
  map.document.tiles = [
    { id: "base", modelId: "floor", x: 4, y: 5, rotation: 0, level: 0 },
  ];
  map.state.tokens = [
    {
      id: "hero",
      kind: "player",
      ref: "41",
      x: 1.5,
      y: 1.5,
      placement: { tileId: "base", point: 0 },
    },
    { id: "removed", placement: { tileId: "gone", point: 0 }, x: 1, y: 1 },
  ];
  map.state.objects = { deleted: true };
  map.state.zones = { deleted: "visible" };
  normalizeSessionMap(map, [model]);
  expect(map.state.tokens).toEqual([
    {
      id: "hero",
      kind: "player",
      ref: "41",
      x: 4.5,
      y: 5.5,
      placement: { tileId: "base", point: 0 },
    },
  ]);
  expect(map.state.objects).toEqual({});
  expect(map.state.zones).toEqual({});
});

it("centres an existing multi-cell token and preserves that centre when its supporting group turns", () => {
  const map=newMap();map.state=initialState();
  const model={id:"floor",width:1,height:1,mountDepth:0,canStand:true,supportSlots:[],placementPoints:[{x:.3,y:.6,elevation:.4,cell:{x:0,y:0}}]};
  map.document.tiles=[0,1].flatMap(y=>[0,1].map(x=>({id:`${x}-${y}`,modelId:"floor",x:x+4,y:y+5,rotation:0,level:0})));
  map.document.tiles[0].rotation=90;map.document.tiles[0].mirrored=true;
  map.state.tokens=[{id:"ogre",kind:"creature",ref:"ogre",size:2,x:4.5,y:5.5,placement:{tileId:"0-0",point:0}}];
  normalizeSessionMap(map,[model]);
  expect(map.state.tokens[0]).toMatchObject({x:5,y:6});
  expect(map.state.tokens[0].anchorOffset[0]).toBeCloseTo(-.3);
  for(const tile of map.document.tiles) {const x=tile.x-4,y=tile.y-5;tile.x=4+1-y;tile.y=5+x;tile.rotation=(tile.rotation+90)%360;}
  normalizeSessionMap(map,[model]);
  expect(map.state.tokens[0]).toMatchObject({x:5,y:6,ref:"ogre"});
});

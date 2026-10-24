import { expect, it } from "vitest";
import { Group, Matrix4 } from "three";
import { createObjectMotion } from "./objectMotion";
it("moves an attached multi-cell creature from its anchor to its offset centre with animated pickup", () => {
  const model={width:1,height:1,placementPoints:[{x:.5,y:.5,elevation:.4,cell:{x:0,y:0}}]};
  const motion=createObjectMotion({metadata:()=>model},()=>new Matrix4().makeTranslation(.5,0,.5));
  const root=new Group(), token=new Group(); token.userData.tokenId="ogre";root.add(token);
  const pose={id:"ogre",kind:"creature",size:2,x:1,y:1,elevation:.45,placement:{tileId:"floor",point:0}};
  const document={tiles:[{id:"floor",modelId:"floor",rotation:0}]};
  motion.update([pose],document);motion.advance(16,root,false);
  expect(token.position.toArray()).toEqual([1,.45,1]);
  motion.update([{...pose,moving:true}],document);motion.advance(16,root,false);
  expect(token.position.y).toBeGreaterThan(.45);expect(token.position.y).toBeLessThan(.67);
  motion.update([{...pose,moving:true,placement:undefined,x:4,y:4}],document);motion.advance(16,root,false);
  expect(token.position.x).toBeGreaterThan(1);expect(token.position.x).toBeLessThan(4);
  motion.destroy();
});
it("animates creature rotation and reflection and settles at the saved pose", () => {
  const motion = createObjectMotion({ metadata: () => null }, () => null);
  const root = new Group(), token = new Group();
  token.userData.tokenId = "creature"; root.add(token);
  const document = { tiles: [] };
  const pose = { id: "creature", x: 2, y: 3, elevation: .05 };
  motion.update([pose], document); motion.advance(280, root);
  expect(token.rotation.y).toBeCloseTo(0);
  motion.update([{ ...pose, rotation: 90, mirrored: true }], document);
  motion.advance(60, root);
  expect(Math.abs(token.scale.x)).toBeLessThan(1);
  motion.advance(280, root);
  expect(token.rotation.y).toBeCloseTo(-Math.PI / 2);
  expect(token.scale.x).toBe(-1);
  expect(token.position.toArray()).toEqual([2, .05, 3]);
  motion.destroy();
});
it("creatures attached to a tile follow its live lift transform like model objects", () => {
  const model = {
    width: 1,
    height: 1,
    placementPoints: [{ cell: { x: 0, y: 0 }, x: 0.5, y: 0.5, elevation: 0.4 }],
  };
  const motion = createObjectMotion({ metadata: () => model }, () =>
    new Matrix4().makeTranslation(3, 1, 5),
  );
  const root = new Group(),
    token = new Group();
  token.userData.tokenId = "hero";
  root.add(token);
  motion.update(
    [
      {
        id: "hero",
        x: 3,
        y: 5,
        elevation: 0.4,
        rotation: 0,
        placement: { tileId: "base", point: 0 },
      },
    ],
    { tiles: [{ id: "base", modelId: "floor", rotation: 0 }] },
  );
  motion.advance(1000, root);
  expect(token.position.toArray()).toEqual([3, 1.45, 5]);
  motion.destroy();
});
it("keeps independent props upright while following reflected physical points", async () => {
  const { tileTransform } = await import("./tileTransform");
  const model = {
    width: 3,
    height: 1,
    placementPoints: [{ x: 0.25, y: 0.5, elevation: 0.8 }],
  };
  const tile = {
    id: "base",
    modelId: "floor",
    x: 2,
    y: 3,
    rotation: 90,
    mirrored: true,
  };
  const motion = createObjectMotion({ metadata: () => model }, () =>
    tileTransform(tile, model),
  );
  const root = new Group(),
    object = new Group();
  object.userData.objectId = "chest";
  root.add(object);
  motion.update(
    [
      {
        id: "chest",
        x: 2.5,
        y: 5.75,
        elevation: 0.8,
        rotation: 0,
        placement: { tileId: "base", point: 0 },
      },
    ],
    { tiles: [tile] },
  );
  motion.advance(1000, root);
  expect(object.position.x).toBeCloseTo(2.5);
  expect(object.position.z).toBeCloseTo(5.75);
  expect(Math.cos(object.rotation.y)).toBeCloseTo(1);
  motion.destroy();
});

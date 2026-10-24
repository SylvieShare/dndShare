import { expect, it, vi } from "vitest";
import { BoxGeometry, Group, Matrix4, Mesh, Vector3 } from "three";
import { createShadowProxies } from "./shadowProxies";
import { tileTransform } from "./tileTransform";
function fixture() {
  const geometry = new BoxGeometry(0.8, 0.1, 0.2),
    dispose = vi.spyOn(geometry, "dispose"),
    part = { geometry, matrix: new Matrix4().makeTranslation(0, 0.35, 0.1) },
    metadata = {
      id: "stairs",
      width: 1,
      height: 1,
      mountDepth: 0.15,
      placementOffset: [0.03, -0.02],
      surfaceHeight: 0.4,
      maxHeight: 1.2,
      blockers: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      ],
    },
    assets = {
      metadata: () => metadata,
      model: vi.fn((id, tier) =>
        tier === "shadow" ? { parts: [part] } : null,
      ),
    },
    proxy = createShadowProxies(assets),
    tiles = [0, 1].map((x) => ({
      id: `t${x}`,
      modelId: "stairs",
      x,
      y: 0,
      rotation: 90,
      elevation: 1,
    })),
    document = { tiles, objects: [], areas: [] };
  return { geometry, dispose, part, metadata, assets, proxy, tiles, document };
}
it("uses the creature shadow proxy at the same size and ground datum as its visual", () => {
  const f = fixture(),
    roots = new Group(),
    token = new Group();
  token.userData.tokenId = "creature";
  token.position.set(2, 0.05, 3);
  roots.add(token);
  const item = {
    id: "creature",
    modelId: "stairs",
    x: 2,
    y: 3,
    scale: 2,
    tokenSize: 2,
  };
  f.proxy.update({ ...f.document, tiles: [] }, [], [item], {}, roots);
  f.proxy.advance(() => null, roots);
  const matrix = new Matrix4();
  f.proxy.root.children[0].getMatrixAt(0, matrix);
  const expected = new Matrix4()
    .makeScale(2, 2, 2)
    .setPosition(2, 0, 3)
    .multiply(f.part.matrix);
  matrix.elements.forEach((v, i) =>
    expect(v).toBeCloseTo(expected.elements[i], 5),
  );
  f.proxy.destroy();
});
it("follows separate body and base roots through rotation, reflection and vertical placement", () => {
  const f = fixture(), roots = new Group(), token = new Group();
  token.userData.tokenId = "creature";
  token.position.set(2, 3.05, 4);
  token.rotation.y = -Math.PI / 2;
  token.scale.x = -1;
  const body = new Group(), base = new Group();
  body.userData.tokenBody = true;
  body.position.y = .01;
  body.scale.setScalar(2);
  base.userData.tokenBase = true;
  base.position.y = -.05;
  token.add(body, base); roots.add(token);
  const instances = ["body", "base"].map(tokenPart => ({
    id: tokenPart, tokenId: "creature", modelId: "stairs", tokenPart, tokenSize: 2, x: 2, y: 4,
  }));
  f.proxy.update({ ...f.document, tiles: [] }, [], instances, {}, roots);
  f.proxy.advance(() => null, roots);
  const actual = new Matrix4();
  for (const [i, visual] of [body, base].entries()) {
    const expected = visual.matrixWorld.clone().multiply(f.part.matrix);
    f.proxy.root.children[0].getMatrixAt(i, actual);
    actual.elements.forEach((v, j) => expect(v).toBeCloseTo(expected.elements[j], 5));
  }
  expect(f.proxy.advance(() => null, roots)).toBe(false);
  token.remove(base);
  f.proxy.advance(() => null, roots);
  f.proxy.root.children[0].getMatrixAt(1, actual);
  expect(actual.determinant()).toBe(0);
  f.proxy.destroy();
});
it("shares real shadow geometry without filling blockers and preserves peg, rotation and part transforms", () => {
  const f = fixture();
  f.proxy.update(f.document, f.tiles, [], {}, new Group());
  expect(f.proxy.root.children).toHaveLength(1);
  const mesh = f.proxy.root.children[0];
  expect(mesh.isInstancedMesh).toBe(true);
  expect(mesh.count).toBe(2);
  expect(mesh.geometry).toBe(f.geometry);
  expect(f.assets.model.mock.calls.every(([, tier]) => tier === "shadow")).toBe(
    true,
  );
  f.proxy.advance(() => null, new Group());
  const actual = new Matrix4(),
    expected = tileTransform(f.tiles[0], f.metadata).multiply(f.part.matrix);
  mesh.getMatrixAt(0, actual);
  actual.elements.forEach((v, i) =>
    expect(v).toBeCloseTo(expected.elements[i], 6),
  );
  expect(f.proxy.advance(() => null, new Group())).toBe(false);
  f.proxy.destroy();
  expect(f.dispose).not.toHaveBeenCalled();
});
it("follows animated tile and object poses, excluding hidden geometry", () => {
  const f = fixture(),
    objects = new Group(),
    visual = new Group();
  visual.userData.objectId = "chest";
  visual.position.set(3, 1, 4);
  visual.scale.setScalar(1.5);
  objects.add(visual);
  const object = { id: "chest", modelId: "stairs", x: 3, y: 4, scale: 1.5 },
    document = {
      ...f.document,
      objects: [object],
      areas: [{ hidden: true, tileIds: ["t1"], objectIds: [] }],
    };
  f.proxy.update(document, f.tiles, [object], {}, objects);
  const mesh = f.proxy.root.children[0];
  expect(mesh.count).toBe(2);
  const animated = new Matrix4().makeTranslation(2, 2.5, 3),
    actual = new Matrix4();
  expect(f.proxy.advance(() => animated, objects)).toBe(true);
  mesh.getMatrixAt(0, actual);
  expect(new Vector3().setFromMatrixPosition(actual).y).toBeCloseTo(2.85);
  mesh.getMatrixAt(1, actual);
  expect(new Vector3().setFromMatrixPosition(actual).y).toBeCloseTo(1.525);
  expect(f.proxy.advance(() => animated, objects)).toBe(false);
  f.proxy.destroy();
});
it("never fabricates an enclosure while the shadow GLB is loading", () => {
  const f = fixture();
  f.assets.model.mockReturnValue(null);
  f.proxy.update(f.document, f.tiles, [], {});
  expect(f.proxy.root.children).toHaveLength(0);
  f.proxy.destroy();
});
it("keeps actual procedural parts and openings of older objects", () => {
  const f = fixture(),
    objects = new Group(),
    visual = new Group(),
    leg = new Mesh(f.geometry);
  visual.userData.objectId = "table";
  leg.position.set(0.25, 0.5, 0);
  visual.add(leg);
  visual.position.set(3, 0, 2);
  objects.add(visual);
  f.proxy.update(
    { ...f.document, tiles: [] },
    [],
    [{ id: "table", kind: "table" }],
    {},
    objects,
  );
  f.proxy.advance(() => new Matrix4(), objects);
  const group = f.proxy.root.children[0];
  expect(group.children).toHaveLength(1);
  expect(group.children[0].geometry).toBe(f.geometry);
  expect(
    new Vector3().setFromMatrixPosition(group.children[0].matrix).x,
  ).toBeCloseTo(0.25);
  f.proxy.destroy();
});
it("keeps shadow batches out of the normal color pass and follows object drag lift", () => {
  const f = fixture(),
    preview = new Group(),
    visual = new Group(),
    object = {
      id: "drag",
      modelId: "stairs",
      x: 2,
      y: 3,
      elevation: 1,
      scale: 1,
    };
  visual.position.set(2.2, 1.22, 3.1);
  preview.add(visual);
  f.proxy.update(
    { ...f.document, tiles: [] },
    [],
    [],
    { previewObject: object },
    new Group(),
    preview,
  );
  f.proxy.advance(() => null, new Group(), preview);
  const mesh = f.proxy.root.children[0],
    matrix = new Matrix4();
  mesh.getMatrixAt(0, matrix);
  expect(new Vector3().setFromMatrixPosition(matrix).y).toBeCloseTo(1.57);
  expect(mesh.count).toBe(1);
  mesh.onBeforeRender();
  expect(mesh.count).toBe(0);
  mesh.onAfterRender();
  expect(mesh.count).toBe(1);
  f.proxy.destroy();
});

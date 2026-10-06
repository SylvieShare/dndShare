import { expect, it } from "vitest";
import { areaAppearance, assignArea, pruneAreas } from "./mapAreas";
import { createTileLayer } from "../rendering/tileLayer";
import { BoxGeometry, Matrix4, MeshStandardMaterial } from "three";
const document = () => ({
  tiles: [{ id: "a" }, { id: "b" }],
  objects: [{ id: "chest" }],
  areas: [
    {
      id: "room",
      name: "Зал",
      hidden: true,
      tileIds: ["a"],
      objectIds: ["chest"],
    },
    {
      id: "other",
      name: "Коридор",
      hidden: false,
      tileIds: ["b"],
      objectIds: [],
    },
  ],
});
it("hides grouped models in the editor/screen and uses 12% opacity in the session", () => {
  const d = document(),
    hidden = areaAppearance(d),
    ghost = areaAppearance(d, "ghost");
  expect([...hidden.hiddenTiles]).toEqual(["a"]);
  expect([...hidden.hiddenObjects]).toEqual(["chest"]);
  expect(ghost.hiddenTiles.size).toBe(0);
  expect(ghost.tileOpacity("a")).toBe(0.12);
  expect(ghost.objectOpacity("chest")).toBe(0.12);
  expect(ghost.tileOpacity("b")).toBe(1);
  expect(d.tiles).toHaveLength(2);
});
it("transfers membership without duplication and removes stale references while keeping empty areas", () => {
  const d = document();
  assignArea(d, "other", { tiles: ["a", "a"], objects: ["chest"] });
  expect(d.areas[0].tileIds).toEqual([]);
  expect(d.areas[1].tileIds).toEqual(["b", "a"]);
  expect(d.areas[1].objectIds).toEqual(["chest"]);
  d.tiles = [];
  d.objects = [];
  pruneAreas(d);
  expect(d.areas).toHaveLength(2);
  expect(d.areas.every((a) => !a.tileIds.length && !a.objectIds.length)).toBe(
    true,
  );
});
it("separates opaque and ghost instances of the same model without changing cached materials", () => {
  const geometry = new BoxGeometry(),
    material = new MeshStandardMaterial();
  const layer = createTileLayer(
    {
      metadata: () => ({ width: 1, height: 1 }),
      model: () => ({ parts: [{ geometry, material, matrix: new Matrix4() }] }),
    },
    { material: (m) => m },
  );
  const tiles = [
    { id: "a", modelId: "floor", x: 1, y: 1, rotation: 0 },
    { id: "b", modelId: "floor", x: 2, y: 1, rotation: 0 },
  ];
  layer.rebuild(
    tiles,
    "render",
    [],
    areaAppearance(document(), "ghost").tileOpacity,
  );
  expect(layer.root.children.map((m) => m.material.opacity).sort()).toEqual([
    0.12, 1,
  ]);
  expect(material.opacity).toBe(1);
  layer.rebuild(tiles, "render", ["a"]);
  expect(layer.root.children[0].count).toBe(1);
  layer.destroy();
  geometry.dispose();
  material.dispose();
});

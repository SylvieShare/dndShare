import { expect, it, vi } from "vitest";
import { Matrix4, PlaneGeometry, Texture } from "three";
import { createMapDecals } from "./mapDecals";

function fixture() {
  const source = {
    parts: [{ geometry: new PlaneGeometry(4, 4), matrix: new Matrix4() }],
  };
  const owner = { matrix: new Matrix4(), source, visible: true };
  const loaded = [],
    loader = {
      load: vi.fn((url, ready) => {
        const texture = new Texture();
        loaded.push(() => ready(texture));
        return texture;
      }),
    };
  const appearance = { tokenOpacity: () => 1, objectOpacity: () => 1 };
  const layer = createMapDecals(
    { material: (m) => m },
    vi.fn(),
    vi.fn(),
    () => owner,
    loader,
  );
  const decal = {
    id: "decal",
    name: "Кровь",
    imageUrl: "/test.png",
    anchor: { kind: "tile", id: "tile" },
    position: [0, 0, 0],
    normal: [0, 0, 1],
    width: 1,
    height: 1,
    depth: 0.15,
    rotation: 0,
    opacity: 0.8,
    color: "#ffffff",
  };
  return { source, owner, loader, loaded, appearance, layer, decal };
}
it("uses a lit shadow-receiving material and reuses projection across motion and visual edits", async () => {
  const { layer, decal, owner, loaded, loader, appearance } = fixture();
  layer.update({ decals: [decal] }, appearance, {});
  loaded.forEach((fn) => fn());
  await layer.ready();
  const group = layer.root.children[0],
    mesh = group.children[0],
    geometry = mesh.geometry;
  expect(mesh.material.isMeshStandardMaterial).toBe(true);
  expect(mesh.receiveShadow).toBe(true);
  expect(mesh.castShadow).toBe(false);
  expect(mesh.material.depthWrite).toBe(false);
  expect(mesh.material.emissive.getHex()).toBe(0);
  owner.matrix.makeTranslation(3, 2, 1);
  layer.advance();
  expect(group.matrix.elements[12]).toBe(3);
  layer.update(
    { decals: [{ ...decal, color: "#aabbcc", opacity: 0.4 }] },
    appearance,
    { selectedDecal: decal.id },
  );
  expect(layer.root.children[0]).toBe(group);
  expect(mesh.geometry).toBe(geometry);
  expect(mesh.material.wireframe).toBe(false);
  expect(mesh.material.opacity).toBe(0.4);
  expect(loader.load).toHaveBeenCalledTimes(1);
  layer.destroy();
});
it("rebuilds for a new LOD source, hides with its owner and disposes removed resources", () => {
  const { layer, decal, owner, appearance } = fixture();
  layer.update({ decals: [decal] }, appearance, {});
  const old = layer.root.children[0],
    disposed = vi.spyOn(old.children[0].geometry, "dispose");
  owner.source = {
    parts: [{ geometry: new PlaneGeometry(2, 2), matrix: new Matrix4() }],
  };
  layer.update({ decals: [decal] }, appearance, {});
  expect(disposed).toHaveBeenCalledOnce();
  expect(layer.root.children[0]).not.toBe(old);
  appearance.tokenOpacity = () => 0;
  layer.advance();
  expect(layer.root.children[0].visible).toBe(false);
  const material = layer.root.children[0].children[0].material,
    release = vi.spyOn(material, "dispose");
  layer.update({ decals: [] }, appearance, {});
  expect(release).toHaveBeenCalledOnce();
  expect(layer.root.children).toHaveLength(0);
  layer.destroy();
});
it("outlines selected and hovered paint using the same geometry and texture alpha, without a rectangular helper", () => {
  const { layer, decal, appearance } = fixture();
  layer.update({ decals: [decal] }, appearance, {
    master: true,
    hoveredDecal: decal.id,
  });
  const group = layer.outlineSources()[0],
    mesh = group.children[0],
    mask = mesh.userData.outlineMaterial;
  expect(group.children).toHaveLength(1);
  expect(mask.map).toBe(mesh.material.map);
  expect(mask.alphaTest).toBeGreaterThan(0);
  expect(mask.depthWrite).toBe(false);
  expect(mask.polygonOffset).toBe(true);
  const shader = { fragmentShader: "#include <map_fragment>" };
  mask.onBeforeCompile(shader);
  expect(shader.fragmentShader).toContain("diffuseColor.rgb = diffuse");
  expect(mask.color.b).toBe(0.55);
  layer.selection({ master: true, selectedDecal: decal.id });
  expect(mask.color.b).toBe(1);
  expect(layer.outlineSources()[0]).toBe(group);
  layer.selection({ master: false });
  expect(layer.outlineSources()).toEqual([]);
  layer.destroy();
});

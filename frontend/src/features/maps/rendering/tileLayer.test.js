import { describe, expect, it, vi } from "vitest";
import {
  BoxGeometry,
  Matrix4,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from "three";
import { createTileLayer } from "./tileLayer";

function setup() {
  const geometry = new BoxGeometry(0.2, 0.8, 1),
    material = new MeshBasicMaterial();
  const model = {
    parts: [
      {
        geometry,
        material,
        matrix: new Matrix4().makeTranslation(-0.4, 0.4, 0),
      },
    ],
  };
  const assets = {
    metadata: () => ({ width: 1, height: 1 }),
    model: () => model,
  };
  const layer = createTileLayer(assets, { material: (m) => m });
  const tile = {
    id: "wall",
    modelId: "test",
    x: 1,
    y: 1,
    rotation: 0,
    level: 0,
  };
  layer.rebuild([tile], "lod");
  const ray = (x, y) =>
    new Raycaster(new Vector3(x, 3, y), new Vector3(0, -1, 0));
  return { layer, ray, tile, geometry, material };
}

describe("tile geometry picking", () => {
  it("updates one instance without disposing other chunk buffers or materials", () => {
    const { layer, tile } = setup();
    layer.rebuild([tile, { ...tile, id: "far", x: 25 }], "lod");
    const chunks = [...layer.root.children],
      versions = chunks.map((mesh) => mesh.instanceMatrix.version);
    const dispose = chunks.map((mesh) => vi.spyOn(mesh, "dispose"));
    layer.rebuild(
      [
        { ...tile, x: 2 },
        { ...tile, id: "far", x: 25 },
      ],
      "lod",
    );
    expect(layer.root.children).toEqual(chunks);
    expect(chunks[0].instanceMatrix.version).toBeGreaterThan(versions[0]);
    expect(chunks[1].instanceMatrix.version).toBe(versions[1]);
    expect(dispose.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    layer.destroy();
  });
  it("hits the wall but leaves empty space in its footprint unselected", () => {
    const { layer, ray } = setup();
    expect(layer.hit(ray(1.1, 1.5))?.tileId).toBe("wall");
    expect(layer.hit(ray(1.8, 1.5))).toBeNull();
    layer.destroy();
  });
  it("uses the actual rotated instance and skips the tile being dragged", () => {
    const { layer, ray, tile } = setup();
    layer.rebuild([{ ...tile, rotation: 90 }], "lod");
    layer.advance(280);
    expect(layer.hit(ray(1.5, 1.9))).toBeNull();
    expect(layer.hit(ray(1.5, 1.1))?.tileId).toBe("wall");
    layer.rebuild([tile], "lod", tile.id);
    expect(layer.hit(ray(1.1, 1.5))).toBeNull();
    layer.destroy();
  });
  it("does not dispose geometry owned by the shared asset cache", () => {
    const { layer, geometry, material } = setup();
    const disposeGeometry = vi.spyOn(geometry, "dispose"),
      disposeMaterial = vi.spyOn(material, "dispose");
    layer.destroy();
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(disposeMaterial).not.toHaveBeenCalled();
  });
});
it("mirrors an asymmetric tile with correct winding, picking and positive instance scales throughout the flip", () => {
  const { layer, ray, tile } = setup();
  layer.rebuild([{ ...tile, mirrored: true }], "lod");
  const matrix = new Matrix4();
  for (let i = 0; i < 12; i++) {
    layer.advance(30);
    for (const mesh of layer.root.children) {
      mesh.getMatrixAt(0, matrix);
      expect(matrix.determinant()).toBeGreaterThan(0);
    }
  }
  expect(layer.hit(ray(1.9, 1.5))?.tileId).toBe("wall");
  expect(layer.hit(ray(1.1, 1.5))).toBeNull();
  const mesh = layer.root.children[0];
  expect(mesh.matrixWorld.determinant()).toBeLessThan(0);
  layer.destroy();
});

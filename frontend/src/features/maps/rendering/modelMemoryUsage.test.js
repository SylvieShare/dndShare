import { expect, it } from "vitest";
import { BoxGeometry, MeshStandardMaterial, DataTexture } from "three";
import { modelMemoryUsage, residentModelUsage } from "./modelMemoryUsage";
it("measures shared geometry buffers and textures once across repeated model parts", () => {
  const geometry = new BoxGeometry(),
    texture = new DataTexture(new Uint8Array(4 * 4 * 4), 4, 4);
  texture.generateMipmaps = false;
  const material = new MeshStandardMaterial({ map: texture });
  const expected = Object.values(geometry.attributes).reduce(
    (n, a) => n + a.array.byteLength,
    geometry.index.array.byteLength,
  );
  const usage = modelMemoryUsage([
    { geometry, material },
    { geometry, material },
  ]);
  expect(usage).toMatchObject({
    geometryBytes: expected,
    textureBytes: 64,
    triangles: 24,
  });
  geometry.dispose();
  material.dispose();
  texture.dispose();
});
it("reports resident files rather than placements or queued assets, without duplicating shared LOD/shadow", () => {
  const usage = { geometryBytes: 200, textureBytes: 300, triangles: 12 };
  const owned = new Map([
    ["/full", { value: { usage, fileBytes: 80 } }],
    ["/coarse", { value: { usage, fileBytes: 20 } }],
    ["/queued", { value: null }],
  ]);
  const catalogue = new Map([
    ["a", { renderUrl: "/full", lodUrl: "/coarse", shadowUrl: "/coarse" }],
    ["b", { renderUrl: "/queued" }],
  ]);
  expect(residentModelUsage(owned, catalogue)).toMatchObject({
    files: 2,
    fileBytes: 100,
    geometryBytes: 400,
    textureBytes: 600,
    triangles: 24,
  });
});

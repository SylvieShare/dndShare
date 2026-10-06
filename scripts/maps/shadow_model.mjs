import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire("/private/tmp/dndshare-model-tools/package.json");
const { NodeIO } = await import(require.resolve("@gltf-transform/core"));
const { ALL_EXTENSIONS } = await import(
  require.resolve("@gltf-transform/extensions")
);
const { join, prune, weld, meshopt, getBounds } = await import(
  require.resolve("@gltf-transform/functions")
);
const { MeshoptEncoder, MeshoptDecoder } = require("meshoptimizer");
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
function triangleCount(document) {
  return document
    .getRoot()
    .listMeshes()
    .reduce(
      (sum, mesh) =>
        sum +
        mesh
          .listPrimitives()
          .reduce(
            (n, p) =>
              n +
              (p.getIndices()?.getCount() ||
                p.getAttribute("POSITION").getCount()) /
                3,
            0,
          ),
      0,
    );
}
export async function prepareShadow(input, output) {
  const source = await fs.readFile(input),
    document = await io.readBinary(source),
    originalTriangles = triangleCount(document),
    before = getBounds(document.getRoot().listScenes()[0]);
  for (const mesh of document.getRoot().listMeshes())
    for (const primitive of mesh.listPrimitives()) {
      primitive.setMaterial(null);
      for (const semantic of primitive.listSemantics())
        if (semantic !== "POSITION") primitive.setAttribute(semantic, null);
    }
  for (const material of document.getRoot().listMaterials()) material.dispose();
  for (const texture of document.getRoot().listTextures()) texture.dispose();
  await document.transform(
    join(),
    weld(),
    prune(),
    meshopt({
      encoder: MeshoptEncoder,
      level: "medium",
      quantizePosition: 16,
    }),
  );
  const bytes = await io.writeBinary(document),
    decoded = await io.readBinary(bytes),
    after = getBounds(decoded.getRoot().listScenes()[0]),
    triangles = triangleCount(decoded);
  if (triangles !== originalTriangles)
    throw new Error("Shadow preparation changed triangle count");
  for (const side of ["min", "max"])
    for (let i = 0; i < 3; i++)
      if (Math.abs(before[side][i] - after[side][i]) > 0.0001)
        throw new Error("Shadow preparation changed coordinates or bounds");
  if (
    decoded.getRoot().listTextures().length ||
    decoded.getRoot().listMaterials().length
  )
    throw new Error("Shadow GLB still contains material resources");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await fs.writeFile(output, bytes);
  return {
    asset: {
      key: `map-models/${sha256}.glb`,
      sha256,
      size: bytes.length,
      mimeType: "model/gltf-binary",
      fileName: "shadow.glb",
    },
    sourceBytes: source.length,
    triangles,
    bounds: after,
  };
}

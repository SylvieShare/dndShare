import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const root = path.resolve(import.meta.dirname, "../..");
const require = createRequire(
  path.join(root, "models/.map-model-tools-runtime/package.json"),
);
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { dedup, prune } = require("@gltf-transform/functions");
const sharp = require("sharp");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const folder = path.resolve(process.argv[2]);
const recipe = process.argv[3]
  ? JSON.parse(await fs.readFile(process.argv[3], "utf8"))
  : {};
const profile = recipe.materialProfile || "native";
if (!["native", "dielectric"].includes(profile))
  throw new Error(`Unknown material profile: ${profile}`);
const materialsOnly = process.argv.includes("--materials-only");
const report = [];
for (const role of ["render", "lod", "shadow", "source"]) {
  const file = role === "render" ? "model.glb" : `model-${role}.glb`;
  const doc = await io.read(path.join(folder, file));
  const materials = doc.getRoot().listMaterials();
  if (profile === "dielectric")
    for (const material of materials) material.setMetallicFactor(0);
  const colours = new Set(
    materials.map((m) => m.getBaseColorTexture()).filter(Boolean),
  );
  const normals = new Set(
    materials.map((m) => m.getNormalTexture()).filter(Boolean),
  );
  let index = 0;
  const textures = [];
  for (const texture of doc.getRoot().listTextures()) {
    const type = colours.has(texture)
      ? "basecolor"
      : normals.has(texture)
        ? "normal"
        : "orm";
    const full = role === "lod" ? 1024 : 2048;
    const limit =
      type === "basecolor" ? full : type === "normal" ? full / 2 : full / 4;
    let data = texture.getImage();
    if (!materialsOnly) {
      const image = sharp(data)
        .resize({
          width: limit,
          height: limit,
          fit: "inside",
          withoutEnlargement: true,
        })
        .removeAlpha();
      data =
        type === "basecolor"
          ? await image.jpeg({ quality: 91, mozjpeg: true }).toBuffer()
          : await image.png({ compressionLevel: 9 }).toBuffer();
      texture
        .setImage(data)
        .setMimeType(type === "basecolor" ? "image/jpeg" : "image/png");
    }
    const dimensions = await sharp(data).metadata();
    textures.push({
      role: type,
      bytes: data.length,
      width: dimensions.width,
      height: dimensions.height,
    });
    if (role === "render") {
      await fs.mkdir(path.join(folder, "textures"), { recursive: true });
      await fs.writeFile(
        path.join(
          folder,
          "textures",
          `${++index}-${type}.${type === "basecolor" ? "jpg" : "png"}`,
        ),
        data,
      );
    }
  }
  await doc.transform(dedup(), prune());
  await io.write(path.join(folder, file), doc);
  let triangles = 0,
    vertices = 0,
    parts = 0;
  const low = [Infinity, Infinity, Infinity],
    high = [-Infinity, -Infinity, -Infinity];
  for (const node of doc.getRoot().listNodes())
    for (const primitive of node.getMesh()?.listPrimitives() || []) {
      const pos = primitive.getAttribute("POSITION"),
        matrix = node.getWorldMatrix(),
        point = [];
      parts++;
      vertices += pos.getCount();
      triangles += (primitive.getIndices()?.getCount() || pos.getCount()) / 3;
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, point);
        if (!point.every(Number.isFinite)) throw Error("Nonfinite vertex");
        for (let axis = 0; axis < 3; axis++) {
          const value =
            matrix[axis] * point[0] +
            matrix[axis + 4] * point[1] +
            matrix[axis + 8] * point[2] +
            matrix[axis + 12];
          low[axis] = Math.min(low[axis], value);
          high[axis] = Math.max(high[axis], value);
        }
      }
    }
  report.push({
    role,
    file,
    bytes: (await fs.stat(path.join(folder, file))).size,
    triangles,
    vertices,
    parts,
    bounds: [low, high],
    textures,
  });
}
await fs.writeFile(
  path.join(folder, "model-stats.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    report.map(({ role, triangles, parts, bytes }) => ({
      role,
      triangles,
      parts,
      bytes,
    })),
  ),
);

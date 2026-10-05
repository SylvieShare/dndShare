// The three skull columns have stone shells and bone-filled cavities in the PDF.
import { srgbToLinear, STONE } from "./masonry_palette.mjs";
const bone = [0.79, 0.72, 0.52].map(srgbToLinear);
const chroma = bone.map((v) => v / Math.max(...bone));
const factors = STONE.map((v, i) => srgbToLinear(v) / bone[i]);
const linear = Array.from({ length: 256 }, (_, i) => srgbToLinear(i / 255));
const toSrgb = (v) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;

export function columnBoneAt(code, x, y, z) {
  const radius = Math.hypot(x, y);
  if (code === "UD-087") return radius < 7.5 && z > 51;
  if (code === "UD-088")
    return (
      (radius < 8.5 && z > 24) || (radius > 13 && z > 24 && z < 32 && y < -6)
    );
  if (code === "UD-089")
    return (
      x * x + ((z - 27 - 0.3 * y) / Math.hypot(1, 0.3)) ** 2 < 6.5 ** 2 &&
      z > 16
    );
  return false;
}

export function columnMask(doc, code, width, height) {
  const mask = new Uint8Array(width * height);
  for (const node of doc.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    const matrix = node.getWorldMatrix();
    for (const primitive of node.getMesh().listPrimitives()) {
      const material = primitive.getMaterial(),
        info = material.getBaseColorTextureInfo();
      if (!info || !material.getBaseColorTexture()) continue;
      const uv = primitive.getAttribute("TEXCOORD_" + info.getTexCoord());
      const positions = primitive.getAttribute("POSITION"),
        indices = primitive.getIndices();
      const transform = info.getExtension("KHR_texture_transform");
      const scale = transform?.getScale() || [1, 1],
        offset = transform?.getOffset() || [0, 0],
        angle = transform?.getRotation() || 0;
      for (let i = 0; i < indices.getCount(); i += 3) {
        const points = [],
          pixels = [];
        for (let j = 0; j < 3; j++) {
          const index = indices.getScalar(i + j),
            p = positions.getElement(index, []),
            t = uv.getElement(index, []);
          const world = Array.from(
            { length: 3 },
            (_, a) =>
              matrix[a] * p[0] +
              matrix[4 + a] * p[1] +
              matrix[8 + a] * p[2] +
              matrix[12 + a],
          );
          points.push([world[0] * 35, -world[2] * 35, world[1] * 35]);
          const u = t[0] * scale[0],
            v = t[1] * scale[1];
          pixels.push([
            (u * Math.cos(angle) - v * Math.sin(angle) + offset[0]) * width,
            (u * Math.sin(angle) + v * Math.cos(angle) + offset[1]) * height,
          ]);
        }
        const [[ax, ay], [bx, by], [cx, cy]] = pixels,
          den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
        if (Math.abs(den) < 1e-6) continue;
        const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))),
          maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx)));
        const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))),
          maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
        for (let y = minY; y <= maxY; y++)
          for (let x = minX; x <= maxX; x++) {
            const a =
                ((by - cy) * (x + 0.5 - cx) + (cx - bx) * (y + 0.5 - cy)) / den,
              b =
                ((cy - ay) * (x + 0.5 - cx) + (ax - cx) * (y + 0.5 - cy)) / den,
              c = 1 - a - b;
            if (a < -0.001 || b < -0.001 || c < -0.001) continue;
            const p = points[0].map(
              (v, k) => v * a + points[1][k] * b + points[2][k] * c,
            );
            mask[y * width + x] = columnBoneAt(code, ...p) ? 2 : 1;
          }
      }
    }
  }
  // Carry the corrected colour into the baked UV gutters, avoiding yellow seams.
  for (let pass = 0; pass < 4; pass++) {
    const next = mask.slice();
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (mask[y * width + x] === 1)
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nx = x + dx,
              ny = y + dy;
            if (
              nx >= 0 &&
              ny >= 0 &&
              nx < width &&
              ny < height &&
              mask[ny * width + nx] === 0
            )
              next[ny * width + nx] = 1;
          }
    mask.set(next);
  }
  return mask;
}

export function repairColumnBones(data, channels, mask) {
  let repaired = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== 1) continue;
    const start = i * channels,
      rgb = [0, 1, 2].map((c) => linear[data[start + c]]),
      maximum = Math.max(...rgb);
    if (maximum < 0.0001) continue;
    const distance = Math.hypot(...rgb.map((v, c) => v / maximum - chroma[c]));
    const t = Math.max(0, Math.min(1, (0.115 - distance) / 0.06)),
      weight = t * t * (3 - 2 * t);
    if (!weight) continue;
    repaired++;
    for (let c = 0; c < 3; c++)
      data[start + c] = Math.round(
        Math.max(
          0,
          Math.min(1, toSrgb(rgb[c] * (1 + weight * (factors[c] - 1)))),
        ) * 255,
      );
  }
  return repaired;
}

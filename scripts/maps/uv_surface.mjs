// Sample baked UV pixels back onto the physical surface, in cropped STL mm.
export function rasterizeSurface(
  doc,
  width,
  height,
  visitor,
  slot = "BaseColor",
) {
  const coverage = new Uint8Array(width * height);
  for (const node of doc.getRoot().listNodes()) {
    if (!node.getMesh()) continue;
    const matrix = node.getWorldMatrix();
    for (const primitive of node.getMesh().listPrimitives()) {
      const material = primitive.getMaterial(),
        info = material["get" + slot + "TextureInfo"]();
      if (!info || !material["get" + slot + "Texture"]()) continue;
      const uv = primitive.getAttribute("TEXCOORD_" + info.getTexCoord()),
        positions = primitive.getAttribute("POSITION"),
        normals = primitive.getAttribute("NORMAL"),
        indices = primitive.getIndices();
      const transform = info.getExtension("KHR_texture_transform"),
        scale = transform?.getScale() || [1, 1],
        offset = transform?.getOffset() || [0, 0],
        angle = transform?.getRotation() || 0;
      for (let i = 0; i < indices.getCount(); i += 3) {
        const points = [],
          pixels = [],
          directions = [];
        for (let j = 0; j < 3; j++) {
          const index = indices.getScalar(i + j),
            p = positions.getElement(index, []),
            t = uv.getElement(index, []),
            n = normals.getElement(index, []);
          const world = Array.from(
            { length: 3 },
            (_, a) =>
              matrix[a] * p[0] +
              matrix[4 + a] * p[1] +
              matrix[8 + a] * p[2] +
              matrix[12 + a],
          );
          const normal = Array.from(
            { length: 3 },
            (_, a) =>
              matrix[a] * n[0] + matrix[4 + a] * n[1] + matrix[8 + a] * n[2],
          );
          points.push([world[0] * 35, -world[2] * 35, world[1] * 35]);
          directions.push([normal[0], -normal[2], normal[1]]);
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
          maxX = Math.min(width - 1, Math.ceil(Math.max(ax, bx, cx))),
          minY = Math.max(0, Math.floor(Math.min(ay, by, cy))),
          maxY = Math.min(height - 1, Math.ceil(Math.max(ay, by, cy)));
        for (let y = minY; y <= maxY; y++)
          for (let x = minX; x <= maxX; x++) {
            const a =
                ((by - cy) * (x + 0.5 - cx) + (cx - bx) * (y + 0.5 - cy)) / den,
              b =
                ((cy - ay) * (x + 0.5 - cx) + (ax - cx) * (y + 0.5 - cy)) / den,
              c = 1 - a - b;
            if (a < -0.001 || b < -0.001 || c < -0.001) continue;
            const position = points[0].map(
                (v, k) => v * a + points[1][k] * b + points[2][k] * c,
              ),
              normal = directions[0].map(
                (v, k) => v * a + directions[1][k] * b + directions[2][k] * c,
              );
            const length = Math.hypot(...normal);
            visitor(
              y * width + x,
              position,
              normal.map((v) => v / length),
            );
            coverage[y * width + x] = 1;
          }
      }
    }
  }
  return coverage;
}

export function extendUvGutters(
  data,
  channels,
  coverage,
  width,
  height,
  radius,
) {
  for (let pass = 0; pass < radius; pass++) {
    const next = coverage.slice();
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (coverage[index]) continue;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx,
            ny = y + dy,
            source = ny * width + nx;
          if (
            nx < 0 ||
            ny < 0 ||
            nx >= width ||
            ny >= height ||
            !coverage[source]
          )
            continue;
          for (let c = 0; c < channels; c++)
            data[index * channels + c] = data[source * channels + c];
          next[index] = 1;
          break;
        }
      }
    coverage.set(next);
  }
}

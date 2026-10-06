// Continuous three-dimensional grain, without directional stripe artefacts.
const hash = (x, y, z) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return v - Math.floor(v);
};
export function surfaceNoise(x, y, z) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const fade = (v) => v * v * (3 - 2 * v);
  const tx = fade(x - ix),
    ty = fade(y - iy),
    tz = fade(z - iz);
  let result = 0;
  for (let dx = 0; dx < 2; dx++)
    for (let dy = 0; dy < 2; dy++)
      for (let dz = 0; dz < 2; dz++)
        result +=
          hash(ix + dx, iy + dy, iz + dz) *
          (dx ? tx : 1 - tx) *
          (dy ? ty : 1 - ty) *
          (dz ? tz : 1 - tz);
  return result;
}

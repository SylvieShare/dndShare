export function proximitySample(grid, point) {
  const cell = point.map((v, i) => (v - grid.low[i]) / grid.stepMM);
  if (cell.some((v, i) => v < 0 || v > grid.size[i] - 1)) return null;
  const low = cell.map(Math.floor),
    high = low.map((v, i) => Math.min(v + 1, grid.size[i] - 1));
  const fraction = cell.map((v, i) => v - low[i]);
  let result = 0;
  for (let z = 0; z < 2; z++)
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        const coordinate = [x, y, z].map((v, i) => (v ? high[i] : low[i]));
        const weight = [x, y, z].reduce(
          (w, v, i) => w * (v ? fraction[i] : 1 - fraction[i]),
          1,
        );
        result +=
          weight *
          grid.values[
            (coordinate[2] * grid.size[1] + coordinate[1]) * grid.size[0] +
              coordinate[0]
          ];
      }
  return result;
}

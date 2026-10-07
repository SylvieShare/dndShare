export function referenceSample(grid, a, b) {
  const x = Math.round((a - grid.low[0]) / grid.step);
  const y = Math.round((b - grid.low[1]) / grid.step);
  if (x < 0 || y < 0 || x >= grid.size[0] || y >= grid.size[1]) return null;
  return grid.values[y * grid.size[0] + x];
}
export function addedSewerSurface(p, reference, shift = [0, 0]) {
  if (!reference) throw Error("Measured bare surface required for this mask");
  const [x, y, z] = [p[0] - shift[0], p[1] - shift[1], p[2]];
  const floor = referenceSample(reference.floor, x, y);
  const wall = referenceSample(reference.wall, x, z);
  const distances = [];
  if (floor !== null) distances.push(Math.abs(z - floor));
  if (wall !== null) distances.push(Math.abs(y - wall));
  return !distances.length || Math.min(...distances) > 0.38;
}

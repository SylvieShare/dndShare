const corners = [7, 1, 3, 5];
const polygon = (points) => points.map((p) => `${p.x},${p.y}`).join(" ");
export function connectionWallShapes(points) {
  if (points.length !== 8) return [];
  const center = points.reduce(
    (p, q) => ({ x: p.x + q.x / 8, y: p.y + q.y / 8 }),
    { x: 0, y: 0 },
  );
  return corners.map((corner, side) => {
    const a = points[corner],
      b = points[corners[(side + 1) % 4]];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const distance = Math.hypot(center.x - mid.x, center.y - mid.y) || 1;
    const depth = 14,
      height = Math.max(
        18,
        Math.min(28, Math.hypot(b.x - a.x, b.y - a.y) * 0.2),
      );
    const inset = (p) => ({
      x: p.x + ((center.x - mid.x) * depth) / distance,
      y: p.y + ((center.y - mid.y) * depth) / distance,
    });
    const up = (p) => ({ x: p.x, y: p.y - height });
    return {
      index: side * 2,
      front: polygon([a, b, up(b), up(a)]),
      top: polygon([up(a), up(b), up(inset(b)), up(inset(a))]),
      side: polygon([b, inset(b), up(inset(b)), up(b)]),
    };
  });
}

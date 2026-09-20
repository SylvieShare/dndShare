export const TERRAINS = [
  ['stone', 'Каменные плиты', '#7d8076'],
  ['slate', 'Тёмный камень', '#48515b'],
  ['wood', 'Доски', '#926947'],
  ['earth', 'Земля', '#79684e'],
  ['grass', 'Трава', '#566b44'],
  ['sand', 'Песок', '#b7a078'],
  ['water', 'Вода', '#356c7a'],
  ['lava', 'Лава', '#a83e27'],
  ['chasm', 'Разлом', '#171923'],
  ['wall-stone', 'Каменная стена', '#aaa99c'],
  ['wall-brick', 'Кирпичная стена', '#8e7162'],
  ['wall-wood', 'Деревянная стена', '#73563f'],
  ['wall-rock', 'Скала', '#777b72'],
].map(([id, name, color]) => ({ id, name, color }));
export const OBJECTS = [
  ['door', 'Дверь'],
  ['double-door', 'Двойная дверь'],
  ['portcullis', 'Решётка'],
  ['barrel', 'Бочка'],
  ['crate', 'Ящик'],
  ['table', 'Стол'],
  ['chest', 'Сундук'],
  ['torch', 'Факел'],
  ['stairs', 'Лестница'],
  ['column', 'Колонна'],
  ['rubble', 'Камни'],
  ['bridge', 'Мостик'],
].map(([id, name]) => ({ id, name }));
export const KINDS = {
  tiles: 'Конструктор',
  'image-grid': 'Изображение с сеткой',
  image: 'Изображение без сетки',
};
export const VISIBILITY = [
  { value: 'hidden', label: 'Скрыта' },
  { value: 'explored', label: 'Исследована' },
  { value: 'visible', label: 'Открыта' },
];
export const clone = (value) => JSON.parse(JSON.stringify(value));
export const uid = () => crypto.randomUUID();
export const interactive = (kind) =>
  ['door', 'double-door', 'portcullis', 'chest', 'torch'].includes(kind);
export function newMap(kind = 'tiles') {
  return {
    name: 'Новая карта',
    document: {
      version: 1,
      kind,
      width: 30,
      height: 22,
      grid: { visible: kind !== 'image', offsetX: 0, offsetY: 0 },
      background: {},
      base: 'stone',
      cells: {},
      objects: [],
      zones: [],
    },
    revision: 0,
  };
}
export function initialState() {
  return { fog: true, defaultVisibility: 'hidden', zones: {}, objects: {}, tokens: [] };
}
export function terrainAt(d, x, y) {
  return d.cells[`${x},${y}`] || d.base;
}
export function inside(d, x, y) {
  return x >= 0 && y >= 0 && x < d.width && y < d.height;
}
export function snap(d, p, size = 1) {
  const x =
    d.kind === 'image'
      ? p.x
      : Math.round(p.x - size / 2 - d.grid.offsetX) + size / 2 + d.grid.offsetX;
  const y =
    d.kind === 'image'
      ? p.y
      : Math.round(p.y - size / 2 - d.grid.offsetY) + size / 2 + d.grid.offsetY;
  return {
    x: size > d.width ? d.width / 2 : Math.max(size / 2, Math.min(d.width - size / 2, x)),
    y: size > d.height ? d.height / 2 : Math.max(size / 2, Math.min(d.height - size / 2, y)),
  };
}
export function zoneContains(d, z, x, y) {
  const cx = Math.floor(x - d.grid.offsetX),
    cy = Math.floor(y - d.grid.offsetY);
  const cell = cy * Math.ceil(d.width) + cx;
  return (
    (cx >= 0 &&
      cy >= 0 &&
      cx < Math.ceil(d.width) &&
      cy < Math.ceil(d.height) &&
      z.cells?.includes(cell)) ||
    z.rects?.some((r) => x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height)
  );
}
export function visibilityAt(d, state, x, y) {
  if (!state?.fog) return 'visible';
  const levels = ['hidden', 'explored', 'visible'];
  const zones = d.zones.filter((z) => zoneContains(d, z, x, y));
  return zones.length
    ? levels[Math.max(...zones.map((z) => Math.max(0, levels.indexOf(state.zones[z.id]))))]
    : state.defaultVisibility;
}
export function rectangle(d, a, b, snapToGrid = true) {
  let x = Math.max(0, Math.min(a.x, b.x)),
    y = Math.max(0, Math.min(a.y, b.y));
  let right = Math.min(d.width, Math.max(a.x, b.x)),
    bottom = Math.min(d.height, Math.max(a.y, b.y));
  if (snapToGrid) {
    const ox = d.kind === 'image-grid' ? d.grid.offsetX : 0,
      oy = d.kind === 'image-grid' ? d.grid.offsetY : 0;
    x = Math.max(0, Math.floor(x - ox) + ox);
    y = Math.max(0, Math.floor(y - oy) + oy);
    right = Math.min(d.width, Math.floor(right - ox) + 1 + ox);
    bottom = Math.min(d.height, Math.floor(bottom - oy) + 1 + oy);
  }
  return { x, y, width: Math.max(0.05, right - x), height: Math.max(0.05, bottom - y) };
}
export function lineCells(a, b) {
  let x = Math.floor(a.x),
    y = Math.floor(a.y);
  const bx = Math.floor(b.x),
    by = Math.floor(b.y),
    dx = Math.abs(bx - x),
    dy = -Math.abs(by - y);
  const sx = x < bx ? 1 : -1,
    sy = y < by ? 1 : -1,
    result = [];
  let error = dx + dy;
  for (let n = 0; n < 1000; n++) {
    result.push({ x, y });
    if (x === bx && y === by) break;
    const e = 2 * error;
    if (e >= dy) {
      error += dy;
      x += sx;
    }
    if (e <= dx) {
      error += dx;
      y += sy;
    }
  }
  return result;
}
export function paint(d, points, terrain, radius = 1) {
  for (const p of points)
    for (let y = p.y; y < p.y + radius; y++)
      for (let x = p.x; x < p.x + radius; x++) {
        if (!inside(d, x, y)) continue;
        if (terrain === d.base) delete d.cells[`${x},${y}`];
        else d.cells[`${x},${y}`] = terrain;
      }
}
export function flood(d, point, terrain) {
  const x = Math.floor(point.x),
    y = Math.floor(point.y),
    original = terrainAt(d, x, y);
  if (!inside(d, x, y) || original === terrain) return;
  const queue = [{ x, y }],
    visited = new Set();
  while (queue.length) {
    const p = queue.pop(),
      key = `${p.x},${p.y}`;
    if (visited.has(key) || !inside(d, p.x, p.y) || terrainAt(d, p.x, p.y) !== original) continue;
    visited.add(key);
    paint(d, [p], terrain);
    queue.push(
      { x: p.x - 1, y: p.y },
      { x: p.x + 1, y: p.y },
      { x: p.x, y: p.y - 1 },
      { x: p.x, y: p.y + 1 },
    );
  }
}
export function resized(d, width, height) {
  const next = clone(d),
    oldWidth = Math.ceil(d.width);
  next.width = width;
  next.height = height;
  next.cells = Object.fromEntries(
    Object.entries(d.cells).filter(([key]) => {
      const [x, y] = key.split(',').map(Number);
      return inside(next, x, y);
    }),
  );
  next.objects = d.objects.filter((o) => inside(next, o.x, o.y));
  next.zones = d.zones.map((z) => ({
    ...z,
    cells: (z.cells || [])
      .filter((c) => inside(next, c % oldWidth, Math.floor(c / oldWidth)))
      .map((c) => Math.floor(c / oldWidth) * Math.ceil(width) + (c % oldWidth)),
    rects: (z.rects || [])
      .filter((r) => inside(next, r.x, r.y))
      .map((r) => ({
        ...r,
        width: Math.min(r.width, width - r.x),
        height: Math.min(r.height, height - r.y),
      })),
  }));
  return next;
}

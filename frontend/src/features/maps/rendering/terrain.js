import { Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import { inside, terrainAt } from '../lib/mapModel';
export const CELL = 64;
const wall = (kind) => kind.startsWith('wall-');

export function buildTerrain(d, textures) {
  const layer = new Container(),
    w = d.width * CELL,
    h = d.height * CELL;
  layer.addChild(new TilingSprite({ texture: textures[d.base], width: w, height: h }));
  if (d.kind !== 'tiles') return layer;
  const groups = new Map(),
    outline = new Graphics(),
    shadow = new Graphics();
  const get = (kind) => {
    if (!groups.has(kind)) groups.set(kind, new Graphics());
    return groups.get(kind);
  };
  for (let y = 0; y < d.height; y++)
    for (let x = 0; x < d.width; x++) {
      const kind = terrainAt(d, x, y);
      if (kind === d.base && !wall(kind)) continue;
      const mask = get(kind),
        xx = x * CELL,
        yy = y * CELL;
      if (!wall(kind)) {
        mask.rect(xx, yy, CELL, CELL);
        continue;
      }
      const same = (dx, dy) => inside(d, x + dx, y + dy) && wall(terrainAt(d, x + dx, y + dy));
      mask.roundRect(xx, yy, CELL, CELL, 9);
      if (same(1, 0)) mask.rect(xx + 32, yy, 32, CELL);
      if (same(-1, 0)) mask.rect(xx, yy, 32, CELL);
      if (same(0, 1)) mask.rect(xx, yy + 32, CELL, 32);
      if (same(0, -1)) mask.rect(xx, yy, CELL, 32);
      shadow.roundRect(xx + 5, yy + 7, CELL + 3, CELL + 3, 12);
      if (same(1, 0)) shadow.rect(xx + 37, yy + 7, 35, CELL + 3);
      if (same(-1, 0)) shadow.rect(xx + 5, yy + 7, 32, CELL + 3);
      if (same(0, 1)) shadow.rect(xx + 5, yy + 39, CELL + 3, 35);
      if (same(0, -1)) shadow.rect(xx + 5, yy + 7, CELL + 3, 32);
      for (const [dx, dy, x1, y1, x2, y2] of [
        [0, -1, 5, 2, 59, 2],
        [1, 0, 62, 5, 62, 59],
        [0, 1, 59, 62, 5, 62],
        [-1, 0, 2, 59, 2, 5],
      ]) {
        if (!same(dx, dy)) outline.moveTo(xx + x1, yy + y1).lineTo(xx + x2, yy + y2);
      }
      // Explicit corner bridges connect diagonal wall cells without square gaps.
      for (const dx of [-1, 1])
        for (const dy of [-1, 1]) {
          if (same(dx, dy) && !same(dx, 0) && !same(0, dy)) {
            const cx = xx + (dx > 0 ? CELL : 0),
              cy = yy + (dy > 0 ? CELL : 0);
            mask.poly([cx - 14, cy, cx, cy - 14, cx + 14, cy, cx, cy + 14]);
          }
        }
    }
  // Ground goes below wall shadows, regardless of palette order.
  const add = ([kind, mask]) => {
    mask.fill(0xffffff);
    const texture = new TilingSprite({ texture: textures[kind], width: w, height: h });
    texture.mask = mask;
    layer.addChild(texture, mask);
  };
  for (const entry of groups) if (!wall(entry[0])) add(entry);
  shadow.fill({ color: 0x080c10, alpha: 0.55 });
  layer.addChild(shadow);
  for (const entry of groups) if (wall(entry[0])) add(entry);
  outline.stroke({ color: 0xe8dfbb, width: 2, alpha: 0.48 });
  layer.addChild(outline);
  return layer;
}

export function backgroundSprite(texture, d) {
  const sprite = new Sprite(texture);
  sprite.width = d.width * CELL;
  sprite.height = d.height * CELL;
  return sprite;
}

export function buildGrid(d) {
  const grid = new Graphics();
  if (!d.grid.visible || d.kind === 'image') return grid;
  for (let x = d.grid.offsetX; x <= d.width; x++)
    if (x >= 0) grid.moveTo(x * CELL, 0).lineTo(x * CELL, d.height * CELL);
  for (let y = d.grid.offsetY; y <= d.height; y++)
    if (y >= 0) grid.moveTo(0, y * CELL).lineTo(d.width * CELL, y * CELL);
  grid.stroke({ width: 1, color: 0xded8bf, alpha: 0.22 });
  return grid;
}

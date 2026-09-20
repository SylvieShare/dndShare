import { Sprite, Texture, Graphics, Text, Container } from 'pixi.js';
import { CELL } from './terrain';

export function fogLayer(d, state, master) {
  const root = new Container();
  if (!state?.fog) return root;
  const density = Math.min(24, 4096 / Math.max(d.width, d.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(d.width * density);
  canvas.height = Math.ceil(d.height * density);
  const c = canvas.getContext('2d');
  const paint = (r, level) => {
    const x = r.x * density,
      y = r.y * density,
      w = r.width * density,
      h = r.height * density;
    c.clearRect(x, y, w, h);
    if (level === 'visible') return;
    c.fillStyle = master
      ? level === 'explored'
        ? 'rgba(8,15,27,.2)'
        : 'rgba(8,15,27,.52)'
      : level === 'explored'
        ? 'rgba(8,12,20,.76)'
        : '#0d1119';
    c.fillRect(x, y, w, h);
    if (master && level === 'hidden') {
      c.save();
      c.beginPath();
      c.rect(x, y, w, h);
      c.clip();
      c.strokeStyle = 'rgba(194,200,212,.23)';
      c.lineWidth = 0.6;
      for (let t = x - h; t < x + w; t += 8) {
        c.beginPath();
        c.moveTo(t, y);
        c.lineTo(t + h, y + h);
        c.stroke();
      }
      c.restore();
    }
  };
  paint({ x: 0, y: 0, width: d.width, height: d.height }, state.defaultVisibility);
  for (const level of ['hidden', 'explored', 'visible'])
    for (const zone of d.zones) {
      if ((state.zones[zone.id] || 'hidden') !== level) continue;
      for (const r of zone.rects || []) paint(r, level);
      for (const cell of zone.cells || [])
        paint(
          {
            x: (cell % Math.ceil(d.width)) + d.grid.offsetX,
            y: Math.floor(cell / Math.ceil(d.width)) + d.grid.offsetY,
            width: 1,
            height: 1,
          },
          level,
        );
    }
  const texture = Texture.from(canvas),
    sprite = new Sprite(texture);
  sprite.width = d.width * CELL;
  sprite.height = d.height * CELL;
  root.addChild(sprite);
  root.on('destroyed', () => texture.destroy(true));
  return root;
}

export function zoneLayer(d, selected, showAll) {
  const root = new Container();
  for (const zone of d.zones) {
    if (!showAll && zone.id !== selected) continue;
    const g = new Graphics(),
      active = zone.id === selected;
    for (const r of zone.rects || [])
      g.rect(r.x * CELL, r.y * CELL, r.width * CELL, r.height * CELL);
    for (const cell of zone.cells || [])
      g.rect(
        ((cell % Math.ceil(d.width)) + d.grid.offsetX) * CELL,
        (Math.floor(cell / Math.ceil(d.width)) + d.grid.offsetY) * CELL,
        CELL,
        CELL,
      );
    g.fill({ color: active ? 0xbaa0ed : 0xa8c7d0, alpha: active ? 0.17 : 0.055 }).stroke({
      color: active ? 0xd1b7ff : 0xaac9d4,
      width: 2,
      alpha: 0.8,
    });
    root.addChild(g);
    const r = zone.rects?.[0],
      cell = zone.cells?.[0];
    if (r || cell != null) {
      const label = new Text({
        text: zone.name,
        style: {
          fontFamily: 'Arial',
          fontSize: 15,
          fill: 0xf1e9d8,
          stroke: { color: 0x222035, width: 4 },
        },
      });
      label.position.set(
        (r?.x ?? cell % Math.ceil(d.width)) * CELL + 7,
        (r?.y ?? Math.floor(cell / Math.ceil(d.width))) * CELL + 5,
      );
      root.addChild(label);
    }
  }
  return root;
}

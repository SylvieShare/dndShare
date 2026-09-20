import { Container, Graphics, Text } from 'pixi.js';
import { CELL } from './terrain';

export function drawObject(object, open = object.open) {
  const root = new Container(),
    g = new Graphics();
  root.position.set(object.x * CELL, object.y * CELL);
  root.rotation = (object.rotation * Math.PI) / 180;
  root.scale.set(object.scale);
  root.addChild(g);
  const wood = 0x956a40,
    edge = 0x382b24,
    metal = 0x98a09a;
  const rect = (x, y, w, h, fill, r = 3) =>
    g.roundRect(x, y, w, h, r).fill(fill).stroke({ color: edge, width: 2 });
  g.ellipse(4, 7, 28, 23).fill({ color: 0x070b10, alpha: 0.35 });
  if (object.kind === 'barrel') {
    g.circle(0, 0, 23).fill(wood).stroke({ color: edge, width: 3 });
    for (let x = -14; x <= 14; x += 7)
      g.moveTo(x, -17).lineTo(x, 17).stroke({ color: edge, width: 1, alpha: 0.5 });
    g.circle(0, 0, 19).stroke({ color: metal, width: 3 });
    g.circle(8, 7, 3).fill(edge);
  } else if (object.kind === 'crate' || object.kind === 'chest') {
    rect(-24, -18, 48, 36, wood);
    if (object.kind === 'crate') {
      g.moveTo(-21, -15)
        .lineTo(21, 15)
        .moveTo(21, -15)
        .lineTo(-21, 15)
        .stroke({ color: 0xbe975f, width: 5 });
    } else {
      if (open) {
        rect(-24, -29, 48, 10, wood);
        rect(-19, -12, 38, 25, 0x282325);
        g.circle(5, 2, 5).fill(0xe3b74e);
      } else {
        g.moveTo(-14, -17)
          .lineTo(-14, 17)
          .moveTo(14, -17)
          .lineTo(14, 17)
          .stroke({ color: metal, width: 4 });
        rect(-4, -3, 8, 8, 0xc5a15b, 1);
      }
    }
  } else if (['door', 'double-door', 'portcullis'].includes(object.kind)) {
    rect(-32, -9, 7, 18, metal);
    rect(25, -9, 7, 18, metal);
    if (object.kind === 'portcullis') {
      g.rect(-25, -3, 50, 6).fill(open ? 0x526568 : metal);
      if (!open)
        for (let x = -22; x <= 22; x += 7)
          g.moveTo(x, -12).lineTo(x, 12).stroke({ color: metal, width: 3 });
    } else if (open) {
      rect(-29, -3, 7, 48, wood);
      if (object.kind === 'double-door') rect(22, -3, 7, 48, wood);
      g.arc(-25, 0, 47, 0, Math.PI / 2).stroke({ color: 0xdfba79, width: 1, alpha: 0.5 });
    } else {
      rect(-25, -6, 50, 12, wood, 1);
      g.circle(15, 0, 2.5).fill(0xdfba79);
      if (object.kind === 'double-door')
        g.moveTo(0, -6).lineTo(0, 6).stroke({ color: edge, width: 2 });
    }
  } else if (object.kind === 'table') {
    rect(-37, -22, 74, 44, wood, 6);
    for (let y = -12; y < 20; y += 11)
      g.moveTo(-33, y).lineTo(33, y).stroke({ color: edge, width: 1, alpha: 0.5 });
    g.circle(-17, 0, 8).fill(0xd3c5a3).stroke({ color: edge, width: 1 });
    g.circle(12, 4, 5).fill(0x5f3430);
  } else if (object.kind === 'torch') {
    if (!open)
      for (let r = 80; r > 8; r -= 8) g.circle(0, 0, r).fill({ color: 0xffb342, alpha: 0.018 });
    rect(-5, -4, 10, 23, wood);
    if (!open) {
      g.poly([-8, 1, -6, -13, 0, -25, 8, -8, 7, 1]).fill(0xe59a37);
      g.ellipse(0, -6, 4, 10).fill(0xffe6a0);
    }
  } else if (object.kind === 'stairs' || object.kind === 'bridge') {
    const bridge = object.kind === 'bridge';
    rect(-27, -37, 54, 74, bridge ? wood : 0x696e70);
    for (let y = -34; y <= 34; y += 10) {
      g.rect(-24, y, 48, 2).fill(bridge ? edge : 0x252a30);
      g.rect(-24, y + 2, 48, 1).fill(0xccc9b1);
    }
    if (!bridge) g.poly([0, -24, -7, -13, 7, -13]).fill({ color: 0xede4c8, alpha: 0.55 });
  } else if (object.kind === 'column') {
    rect(-24, -24, 48, 48, 0x757c79, 3);
    g.circle(0, 0, 22).fill(0x929891).stroke({ color: edge, width: 3 });
    g.circle(-3, -3, 16).fill(0xb4b5a2);
  } else {
    for (const [x, y, r] of [
      [-14, 0, 13],
      [9, 8, 17],
      [7, -13, 11],
      [-12, 20, 7],
    ])
      g.poly([x - r, y, x - r / 2, y - r, x + r / 2, y - r * 0.8, x + r, y + r * 0.3, x, y + r])
        .fill(0x737b70)
        .stroke({ color: 0x333b38, width: 2 });
  }
  return root;
}

export function drawToken(token, master) {
  const root = new Container(),
    r = (token.size * CELL) / 2 - 3,
    color = Number.parseInt(token.color.slice(1), 16);
  root.position.set(token.x * CELL, token.y * CELL);
  if (master && (token.hidden || token.physical)) root.alpha = 0.48;
  root.addChild(
    new Graphics()
      .circle(2, 4, r + 3)
      .fill({ color: 0x080c12, alpha: 0.65 })
      .circle(0, 0, r)
      .fill(0x20262e)
      .stroke({ color, width: 4 })
      .circle(0, 0, r - 5)
      .stroke({ color: 0xe7dfc6, width: 1, alpha: 0.3 }),
  );
  const label = new Text({
    text: token.name.slice(0, 2).toLocaleUpperCase(),
    style: {
      fontFamily: 'Arial',
      fontSize: Math.max(12, r * 0.7),
      fontWeight: 'bold',
      fill: 0xf1e9d8,
    },
  });
  label.anchor.set(0.5);
  root.addChild(label);
  const name = new Text({
    text: token.name,
    style: {
      fontFamily: 'Arial',
      fontSize: 12,
      fill: 0xf3ead5,
      stroke: { color: 0x111821, width: 3 },
      wordWrap: true,
      wordWrapWidth: Math.max(70, r * 2.5),
      align: 'center',
    },
  });
  name.anchor.set(0.5, 0);
  name.y = r + 7;
  root.addChild(name);
  return root;
}

import { Texture } from 'pixi.js';
import { TERRAINS } from '../lib/mapModel';

export function random(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
export function terrainTexture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d'),
    rand = random([...kind].reduce((s, v) => s + v.charCodeAt(0), 0));
  c.fillStyle = TERRAINS.find((t) => t.id === kind)?.color || '#77796b';
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5500; i++) {
    c.fillStyle =
      rand() > 0.5 ? `rgba(255,242,207,${rand() * 0.1})` : `rgba(0,0,0,${rand() * 0.12})`;
    const s = rand() * 2 + 0.5;
    c.fillRect(rand() * 256, rand() * 256, s, s);
  }
  if (kind.includes('wood')) {
    for (let y = 0; y < 256; y += 32) {
      c.fillStyle = `rgba(25,13,6,${0.05 + rand() * 0.1})`;
      c.fillRect(0, y, 256, 32);
      c.fillStyle = '#322a2270';
      c.fillRect(0, y, 256, 2);
      c.fillRect((y % 64) * 4, y, 2, 32);
      c.strokeStyle = '#e6be8428';
      c.beginPath();
      c.moveTo(0, y + 3);
      c.lineTo(256, y + 3);
      c.stroke();
      for (let j = 0; j < 8; j++) {
        c.strokeStyle = '#26180e22';
        c.beginPath();
        const yy = y + rand() * 30;
        c.moveTo(0, yy);
        c.bezierCurveTo(65, yy - 3, 145, yy + 4, 256, yy);
        c.stroke();
      }
    }
  } else if (kind === 'stone' || kind === 'slate' || kind.includes('wall')) {
    const h = kind.includes('brick') ? 24 : 64,
      w = kind.includes('brick') ? 64 : 85.33;
    for (let y = 0; y < 256; y += h)
      for (let x = -w; x < 256; x += w) {
        const xx = x + ((Math.round(y / h) % 2) * w) / 2;
        c.fillStyle = `rgba(220,214,190,${rand() * 0.15})`;
        c.fillRect(xx + 2, y + 2, w - 4, h - 4);
        c.strokeStyle = '#181a194a';
        c.lineWidth = 2;
        c.strokeRect(xx + 1, y + 1, w - 2, h - 2);
        c.strokeStyle = '#faf1ce33';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(xx + 3, y + h - 3);
        c.lineTo(xx + 3, y + 3);
        c.lineTo(xx + w - 3, y + 3);
        c.stroke();
        if (rand() > 0.5) {
          c.strokeStyle = '#171b193a';
          c.beginPath();
          c.moveTo(xx + w * 0.6, y + 3);
          c.lineTo(xx + w * 0.5, y + h * 0.4);
          c.lineTo(xx + w * 0.7, y + h * 0.65);
          c.stroke();
        }
      }
  } else if (kind === 'water' || kind === 'lava') {
    for (let i = 0; i < 45; i++) {
      const x = rand() * 256,
        y = rand() * 256;
      c.strokeStyle = kind === 'water' ? '#b4ede72e' : '#ffb33195';
      c.lineWidth = rand() * 2 + 1;
      c.beginPath();
      c.moveTo(x, y);
      c.bezierCurveTo(x + 10, y - 4, x + 20, y + 4, x + 35, y);
      c.stroke();
    }
  } else if (kind === 'grass') {
    for (let i = 0; i < 700; i++) {
      const x = rand() * 256,
        y = rand() * 256;
      c.strokeStyle = rand() > 0.5 ? '#b5bc6938' : '#1a302c45';
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + rand() * 6 - 3, y - rand() * 7);
      c.stroke();
    }
  }
  return Texture.from(canvas);
}

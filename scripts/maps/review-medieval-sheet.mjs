// Diagnostic comparison only; the catalogue keeps separate transparent previews.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('/private/tmp/dndshare-model-tools/package.json');
const sharp = require('sharp');
const code = process.argv[2];
if (!/^MT1-\d{3}$/.test(code || '')) throw new Error('One source code required');
const directory = path.resolve(import.meta.dirname, '../../models/collections/medieval-town-vol1/review', code);
const layers = [];
for (const [row, folder] of [directory, path.join(directory, 'candidates/compact')].entries()) {
  for (const [col, name] of ['preview.png', 'top.png', 'lod-preview.png'].entries()) {
    const file = path.join(folder, name);
    const bytes = await fs.readFile(file);
    const meta = await sharp(bytes).metadata();
    if (meta.width!==512 || meta.height!==512 || !meta.hasAlpha) throw new Error('Expected transparent 512 px diagnostic');
    layers.push({ input: bytes, left: col*512, top: row*520 });
    const label = `${code} ${row ? 'compact' : 'balanced'} ${name}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="20"><text x="8" y="14" font-size="12" font-family="sans-serif">${label}</text></svg>`;
    layers.push({ input: Buffer.from(svg), left: col*512, top: row*520 });
  }
}
await sharp({ create: { width: 1536, height: 1040, channels: 3, background: '#e1e1e1' } })
  .composite(layers).jpeg({ quality: 95 }).toFile(path.join(directory, 'comparison.jpg'));
console.log('MEDIEVAL_COMPARISON', code);

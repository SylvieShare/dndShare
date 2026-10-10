// Add a manually written review note only after confirmed model publication.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const code = process.argv[2], note = process.argv.find(a => a.startsWith('--note='))?.slice(7);
assert.match(code || '', /^MT1-\d{3}$/);
assert.ok(note?.trim() && !/[|\r\n]/.test(note), 'One concise manual material/QA note required');
const root = path.resolve(import.meta.dirname, '../..');
const base = path.join(root, 'models/collections/medieval-town-vol1');
const progress = JSON.parse(await fs.readFile(path.join(base, 'progress.json'), 'utf8'));
assert.equal(progress.find(p => p.code===code)?.status, 'published');
const report = JSON.parse(await fs.readFile(path.join(base, 'review', code, 'report.json'), 'utf8'));
assert.ok(report.publication?.assetsVerified && report.publication?.placementVerified);
const registry = JSON.parse(await fs.readFile(path.join(base, 'registry-snapshot.json'), 'utf8'));
assert.deepEqual(registry.find(m => m.id===report.model.id), report.model);
const file = path.join(root, 'md/features/medieval-town.md');
let wiki = await fs.readFile(file, 'utf8');
const count = progress.filter(p => p.status==='published').length;
const last = progress.filter(p => p.status==='published').at(-1).code.slice(4);
wiki = wiki.replace(/Опубликованы и подтверждены \d+ из 163 моделей: MT1-001–\d+\./,
  `Опубликованы и подтверждены ${count} из 163 моделей: MT1-001–${last}.`);
wiki = wiki.replace(/Остальные \d+ элементов ещё не обработаны\./, `Остальные ${163-count} элементов ещё не обработаны.`);
const sizes = ['render','lod','shadow','preview'].map(k => report.model.assets[k].size).join(' / ');
const row = `| ${code} ${report.model.name} | \`${report.model.id}\` | ${note.trim()} | ${sizes} |`;
const pattern = new RegExp('^\\| '+code+' [^\\n]+$', 'm');
if (pattern.test(wiki)) wiki = wiki.replace(pattern, row);
else wiki = wiki.replace('\n## Уточнение палитры', row+'\n\n## Уточнение палитры');
await fs.writeFile(file, wiki);
console.log('MEDIEVAL_WIKI_RECORDED', code, count, '/', progress.length);

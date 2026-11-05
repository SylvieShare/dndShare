import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readMedievalWikiRow, writeMedievalWikiRow } from './medieval_wiki.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'medieval-wiki-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'md/features/medieval-town'), { recursive: true });
  await fs.writeFile(path.join(root, 'md/features/medieval-town.md'), '# Medieval\n\nОпубликованы и подтверждены 1 из 163 моделей: плитки и объекты — 1, каркасы этажей — 0.\nОстальные 162 элементов ещё не обработаны.\n\n## Связанные страницы\n\n[Wiki](../README.md)\n');
  return root;
}
const update = (code, note = 'Verified') => ({ code, row: `| ${code} Model | uuid | ${note} | 1 / 2 / 3 / 4 |`, count: 2, frameCount: 1, total: 163 });

test('writes a new publication to a linked journal, leaving the overview a summary', async t => {
  const root = await fixture(t);
  await writeMedievalWikiRow(root, update('MT1-733'));
  const found = await readMedievalWikiRow(root, 'MT1-733');
  assert.ok(found.file.endsWith('catalogue-updates-01.md'));
  assert.match(found.row, /Verified/);
  const overview = await fs.readFile(path.join(root, 'md/features/medieval-town.md'), 'utf8');
  assert.match(overview, /подтверждены 2 из 163/);
  assert.match(overview, /catalogue-updates-01\.md/);
  assert.ok(!overview.includes('| MT1-733'));
});

test('updates an existing row without duplicating or moving it', async t => {
  const root = await fixture(t);
  const file = path.join(root, 'md/features/medieval-town/catalogue-01.md');
  await fs.writeFile(file, `# Records\n\n${update('MT1-010').row}\n`);
  await writeMedievalWikiRow(root, update('MT1-010', 'Updated QA'));
  const found = await readMedievalWikiRow(root, 'MT1-010');
  assert.equal(found.file, file);
  assert.match(found.row, /Updated QA/);
  assert.equal((await fs.readdir(path.dirname(file))).length, 1);
});

test('creates a new bounded journal when the previous one is full', async t => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, 'md/features/medieval-town/catalogue-updates-01.md'), '# Existing\n' + 'x'.repeat(24000));
  await writeMedievalWikiRow(root, update('MT1-733'));
  assert.ok((await readMedievalWikiRow(root, 'MT1-733')).file.endsWith('catalogue-updates-02.md'));
});

test('rejects ambiguous duplicate rows', async t => {
  const root = await fixture(t);
  for (const name of ['catalogue-01.md', 'catalogue-02.md']) await fs.writeFile(path.join(root, 'md/features/medieval-town', name), update('MT1-010').row);
  await assert.rejects(readMedievalWikiRow(root, 'MT1-010'), /Duplicate/);
});

test('resuming after a row write repairs its missing overview link', async t => {
  const root = await fixture(t);
  const file = path.join(root, 'md/features/medieval-town/catalogue-updates-01.md');
  await fs.writeFile(file, `# Records\n\n${update('MT1-733').row}\n\n## Связанные страницы\n\n[Overview](../medieval-town.md)\n`);
  await writeMedievalWikiRow(root, update('MT1-733', 'Resumed'));
  const overview = await fs.readFile(path.join(root, 'md/features/medieval-town.md'), 'utf8');
  assert.match(overview, /catalogue-updates-01\.md/);
  assert.match((await readMedievalWikiRow(root, 'MT1-733')).row, /Resumed/);
});

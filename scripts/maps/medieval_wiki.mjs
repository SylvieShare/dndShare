// Local documentation I/O only. Callers verify publication before writing rows.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const folder = root => path.join(root, 'md/features/medieval-town');
const overview = root => path.join(root, 'md/features/medieval-town.md');
const rowPattern = code => new RegExp('^\\| ' + code + ' [^\\n]+$', 'm');

async function journals(root) {
  return (await fs.readdir(folder(root))).filter(name => /^catalogue-(?:\d+|updates-\d+)\.md$/.test(name)).sort();
}

export async function readMedievalWikiRow(root, code) {
  assert.match(code, /^MT1-\d{3}$/);
  const matches = [];
  for (const name of await journals(root)) {
    const file = path.join(folder(root), name);
    const text = await fs.readFile(file, 'utf8');
    const row = text.match(rowPattern(code));
    if (row) matches.push({ file, text, row: row[0] });
  }
  assert.ok(matches.length <= 1, `Duplicate journal rows for ${code}`);
  return matches[0] || null;
}

export async function writeMedievalWikiRow(root, { code, row, count, frameCount, total }) {
  assert.match(code, /^MT1-\d{3}$/);
  assert.ok(rowPattern(code).test(row) && !/[\r\n]/.test(row), 'One complete table row required');
  const home = overview(root);
  let index = await fs.readFile(home, 'utf8');
  assert.ok(index.includes('\n\n## Связанные страницы'), 'Overview footer missing');
  const summary = /^Опубликованы и подтверждены \d+ из \d+ моделей:[^\n]+$/m;
  assert.ok(summary.test(index), 'Publication summary missing from overview');
  index = index.replace(summary, `Опубликованы и подтверждены ${count} из ${total} моделей: плитки и объекты — ${count - frameCount}, каркасы этажей — ${frameCount}.`)
    .replace(/Остальные \d+ элементов ещё не обработаны\./, `Остальные ${total - count} элементов ещё не обработаны.`);
  const existing = await readMedievalWikiRow(root, code);
  let writtenName;
  if (existing) {
    writtenName = path.basename(existing.file);
    await fs.writeFile(existing.file, existing.text.replace(rowPattern(code), row));
  } else {
    const updates = (await journals(root)).filter(name => name.startsWith('catalogue-updates-'));
    let name = updates.at(-1), text = name ? await fs.readFile(path.join(folder(root), name), 'utf8') : '';
    if (!name || text.length + row.length > 24000) {
      const number = updates.length + 1;
      name = `catalogue-updates-${String(number).padStart(2, '0')}.md`;
      text = `# Medieval Town: дополнительные публикации ${number}\n\nСтатус: журнал подтверждённых публикаций конкретных моделей.\n\n| Код | UUID | Материалы и QA | render / LOD / shadow / preview, Б |\n| --- | --- | --- | --- |\n\n## Связанные страницы\n\n[Medieval Town](../medieval-town.md)\n`;
    }
    assert.ok(text.includes('\n\n## Связанные страницы'), 'Journal footer missing');
    text = text.replace('\n\n## Связанные страницы', `\n${row}\n\n## Связанные страницы`);
    await fs.writeFile(path.join(folder(root), name), text);
    writtenName = name;
  }
  const link = `medieval-town/${writtenName}`;
  if (!index.includes(`](${link})`))
    index = index.replace('\n\n## Связанные страницы', `\n\n- [Журнал подтверждённых публикаций ${writtenName}](${link})\n\n## Связанные страницы`);
  await fs.writeFile(home, index);
}

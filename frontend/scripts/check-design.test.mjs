import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkDesign } from './check-design.mjs'

const hash = text => createHash('sha256').update(text).digest('hex')
test('fresh outputs pass; changed source and edited/missing outputs fail the build guard', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-design-'))
  const names = ['frontend/src/app/design-tokens.css', 'frontend/src/app/design-tokens.js',
    'native/androidApp/src/main/kotlin/ru/dndshare/client/ui/designsystem/DesignTokens.kt']
  function write(name, content) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
    fs.writeFileSync(path.join(root, name), content)
  }
  try {
    write('design/tokens.json', '{}\n')
    for (const name of names) write(name, 'generated\r\n')
    write('design/generated.json', JSON.stringify({ schemaVersion: 1, source: 'design/tokens.json',
      sourceSha256: hash('{}\n'), outputs: Object.fromEntries(names.map(name => [name, hash('generated\n')])) }))
    assert.deepEqual(checkDesign(root), [])
    write('design/tokens.json', '{"changed":true}\n')
    write(names[0], 'hand edited\n')
    fs.unlinkSync(path.join(root, names[1]))
    assert.deepEqual(checkDesign(root), ['design/tokens.json', names[0], names[1]])
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

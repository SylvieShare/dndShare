import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const expectedOutputs = [
  'frontend/src/app/design-tokens.css',
  'frontend/src/app/design-tokens.js',
  'native/designSystem/src/main/kotlin/ru/dndshare/designsystem/DesignTokens.kt',
]
const hash = text => createHash('sha256').update(text.replaceAll('\r\n', '\n')).digest('hex')

export function checkDesign(root = path.resolve(import.meta.dirname, '../..')) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'design/generated.json'), 'utf8'))
  const failures = []
  if (manifest.schemaVersion !== 1 || manifest.source !== 'design/tokens.json') throw new Error('Invalid design manifest')
  if (Object.keys(manifest.outputs).sort().join('\n') !== expectedOutputs.toSorted().join('\n')) throw new Error('Invalid design output set')
  if (hash(fs.readFileSync(path.join(root, manifest.source), 'utf8')) !== manifest.sourceSha256) failures.push(manifest.source)
  for (const [name, expected] of Object.entries(manifest.outputs)) {
    if (!fs.existsSync(path.join(root, name)) || hash(fs.readFileSync(path.join(root, name), 'utf8')) !== expected) failures.push(name)
  }
  return failures
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const failures = checkDesign()
    if (failures.length) throw new Error(`Run python3 scripts/design/tokens.py:\n${failures.join('\n')}`)
    console.log('Design source and generated CSS/Compose match.')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

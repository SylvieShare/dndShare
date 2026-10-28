import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
const root = fileURLToPath(new URL('..', import.meta.url))
const output = fileURLToPath(new URL('../../native/androidApp/src/main/assets/rules/creation-data.json', import.meta.url))
const server = await createServer({ root, configFile: false, logLevel: 'error', resolve: { alias: { '@': path.join(root, 'src') } }, server: { middlewareMode: true } })
try {
  const equipment = await server.ssrLoadModule('/src/features/character-editor/settings/dnd/creation/startingEquipment.js')
  const wealth = await server.ssrLoadModule('/src/features/character-editor/settings/dnd/creation/startingShop.js')
  const names = await server.ssrLoadModule('/src/shared/lib/dndNames.js')
  const namesSource = await readFile(path.join(root, 'src/shared/lib/dndNames.js'), 'utf8')
  const nameKeys = [...namesSource.matchAll(/key: '([^']+)', aliases:/g)].map(match => match[1])
  const result = { protocol: 1, equipment: Object.fromEntries(equipment.STARTING_EQUIPMENT_CLASS_KEYS.map(key => [key, equipment.startingEquipmentProfile({ nameEn: key })])),
    wealth: Object.fromEntries(equipment.STARTING_EQUIPMENT_CLASS_KEYS.map(key => [key, wealth.startingWealthRule(key)])),
    names: [...nameKeys.map(key => names.dndNameProfile(key)), names.dndNameProfile(null)] }
  const serialized = `${JSON.stringify(result, null, 2)}\n`
  if (process.argv.includes('--check')) {
    if (await readFile(output, 'utf8') !== serialized) throw new Error('Regenerate Android creation rule data')
  } else { await mkdir(path.dirname(output), { recursive: true }); await writeFile(output, serialized) }
  console.log('Android creation rule data matches web sources')
} finally { await server.close() }

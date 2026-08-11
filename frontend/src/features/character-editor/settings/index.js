/**
 * Hardcoded per-setting registry.
 *
 * Each setting owns its sheet schema (code, not DB JSON) and its semantic
 * accessors. A character template is mapped to its setting purely by
 * `char_template.name`; render schemas live in this registry.
 */
import dndSchema from '@/features/character-editor/settings/dnd/schema'
import { dndAccessors } from '@/features/character-editor/settings/dnd/accessors'
import vtmSchema from '../../../../../resources/char_template_vtm_v20.json'

const vtmAccessors = {
  system: 'vtm-v20',
  hpPath: null,
  displayName: data => String(data?.values?.char_name || ''),
  avatar: data => data?.values?.ava?.url || null,
  race: () => '',
  charClass: () => '',
  subtitle: data => String(data?.values?.persona || ''),
  level: () => '',
  hp: () => null,
  ac: () => null,
  initiativeBonus: () => 0,
  statesValue: () => [],
  abilities: () => [],
  headerTitle(data) { return this.displayName(data) },
  listFields(data) {
    return { name: this.displayName(data) || '(без имени)', avatar: this.avatar(data), who: this.subtitle(data), lvl: '', hp: null, ac: null }
  },
}

const SETTINGS = [
  {
    system: 'dnd5e',
    // char_template.name values that map to this setting.
    names: ['DND5'],
    schema: dndSchema,
    accessors: dndAccessors,
    sourceName: 'DND5e',
    sourceVersion: '2014',
  },
  {
    system: 'vtm-v20',
    names: ['VTM20'],
    schema: vtmSchema,
    accessors: vtmAccessors,
    sourceName: 'Vampire: TM',
    sourceVersion: 'V20',
    createData(name) { return { values: { char_name: name } } },
  },
]

// `template` is a character-template descriptor carrying at least `{ name }`:
// the full template from /templates or a template name from character API.
export function resolveSetting(template) {
  if (!template) return null
  const name = typeof template === 'string' ? template : template.name
  if (!name) return null
  return SETTINGS.find(s => s.names.includes(name)) || null
}

export function settingRenderSchema(template) {
  return resolveSetting(template)?.schema ?? null
}

export function settingAccessors(template) {
  return resolveSetting(template)?.accessors ?? null
}

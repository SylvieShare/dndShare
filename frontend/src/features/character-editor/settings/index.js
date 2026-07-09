/**
 * Hardcoded per-setting registry.
 *
 * Each setting owns its sheet schema (code, not DB JSON) and its semantic
 * accessors. A character template is mapped to its setting purely by
 * `char_template.name` — the DB `schema` column is no longer consulted for
 * identity and may be empty (`{}`), since the real schema is hardcoded here.
 */
import dndSchema from '@/features/character-editor/settings/dnd/schema'
import { dndAccessors } from '@/features/character-editor/settings/dnd/accessors'

const SETTINGS = [
  {
    system: 'dnd5e',
    // char_template.name values that map to this setting.
    names: ['DND5'],
    schema: dndSchema,
    accessors: dndAccessors,
  },
]

// `template` is a character-template descriptor carrying at least `{ name }`:
// the full template from /templates, or a `{ name, schema }` pair assembled for
// the editor. Identity is resolved from the name, never from the schema.
export function resolveSetting(template) {
  if (!template) return null
  const name = typeof template === 'string' ? template : template.name
  if (!name) return null
  return SETTINGS.find(s => s.names.includes(name)) || null
}

// The schema actually rendered for a character: the setting's hardcoded schema
// when one matches, else the template's own DB schema (legacy JSON path, e.g.
// VTM). A bare schema object is tolerated for back-compat.
export function settingRenderSchema(template) {
  return resolveSetting(template)?.schema ?? template?.schema ?? template
}

export function settingAccessors(template) {
  return resolveSetting(template)?.accessors ?? null
}

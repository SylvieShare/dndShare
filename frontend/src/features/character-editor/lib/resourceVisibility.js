import { MAGIC_VALUE_ID } from './characterMagicItems'

/** Hide a contributed resource by default only if the sheet already renders its pool elsewhere. */
export function resourceDisplayedElsewhere(resource, values, actionKeys = new Set(), widgetKeys = new Set()) {
  if (actionKeys.has(String(resource.key)) || widgetKeys.has(String(resource.key))) return true
  return resource.source?.valueId === MAGIC_VALUE_ID
    && (values.weapon || []).some(entry => entry.uid === resource.source.entryKey)
}
export function resourceVisibleHere(resource, values, actionKeys, widgetKeys) {
  if (!resource.readonly) return true
  const preference = values.resource_visibility?.[resource.key]
  return typeof preference === 'boolean' ? preference : !resourceDisplayedElsewhere(resource, values, actionKeys, widgetKeys)
}
export function resourceVisibilityPatch(values, key, visible) {
  return { resource_visibility: { ...(values.resource_visibility || {}), [key]: !!visible } }
}

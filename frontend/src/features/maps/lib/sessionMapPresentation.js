import { DEFAULT_SUN } from './mapLighting'

export function sessionLighting(document, state) {
  return state.lighting || {
    enabled: document.lightingEnabled,
    sun: { ...(document.sun || DEFAULT_SUN) },
    lights: {},
  }
}

export function sessionMapDocument(document, state) {
  if (!state) return document
  const lighting = sessionLighting(document, state)
  return {
    ...document,
    areas: (document.areas || []).map(area => ({
      ...area,
      hidden: state.areas?.[area.id] == null ? area.hidden : !state.areas[area.id],
    })),
    lightingEnabled: lighting.enabled,
    sun: lighting.sun,
    lights: (document.lights || []).map(light => ({
      ...light,
      enabled: lighting.lights[light.id] ?? light.enabled,
    })),
  }
}

export function changeSessionLighting(document, state, update) {
  state.lighting ||= sessionLighting(document, state)
  update(state.lighting)
}

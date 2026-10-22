import { pruneDecals } from "../lib/mapDecals";
import { canonicalMapData } from '@/shared/api/mapDocumentData'
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { saveMap } from '@/shared/api/mapsApi'
import { clone } from '../lib/mapModel'
import { syncSurfaceObjects } from '../lib/surfacePlacement'
import { pruneAreas } from '../lib/mapAreas'
import { syncLights } from '../lib/mapLighting'
import { useStoredMapPreview } from './useStoredMapPreview'
import {
  reloadMapDocument,
  discardMapDocument,
} from '@/shared/api/mapDocuments'
import { documentDiff, rebaseDocumentChanges } from '@/shared/lib/documentPatch'

const content = (map) => ({
  name: map.name,
  document: map.document,
  ...(map.state ? { state: map.state } : {}),
})

export function useMapPersistence({
  draft,
  journal,
  catalogue,
  loadingModels,
  gesturing,
  options,
  onSaved,
  source,
  finishLightEdit,
}) {
  const { dirty } = journal
  const saving = ref(false),
    error = ref(''),
    saveError = ref(''),
    conflict = ref(false)
  const lastSavedAt = ref(source?.changedAt || null)
  const preview = useStoredMapPreview({
    source,
    catalogue,
    session: options.session,
    journal,
    gesturing,
    loadingModels,
    saving,
    conflict,
  })

  let timer,
    stopped = false
  // Document history never rolls the server's compare-and-swap version back.
  let record = { id: draft.value.id, revision: draft.value.revision }
  async function save() {
    clearTimeout(timer)
    await nextTick()
    if (
      saving.value ||
      loadingModels.value ||
      conflict.value ||
      !dirty.value ||
      !draft.value.name.trim()
    )
      return
    saving.value = true
    error.value = ''
    saveError.value = ''
    syncSurfaceObjects(draft.value.document, catalogue.value)
    pruneAreas(draft.value.document)
    syncLights(draft.value.document, catalogue.value)
    options.normalize?.(draft.value, catalogue.value)
    draft.value.document = canonicalMapData(draft.value).document
    pruneDecals(draft.value.document)
    finishLightEdit()
    journal.commit()
    await nextTick()
    const savedVersion = journal.revision.value
    const snapshot = { ...clone(draft.value), ...record }
    try {
      const result = await (options.save || saveMap)(snapshot)
      record = { id: result.id, revision: result.revision }
      const next = rebaseDocumentChanges(
        content(snapshot),
        content(result),
        documentDiff(content(snapshot), content(draft.value)),
        canonicalMapData,
      ).data
      const canonical = documentDiff(content(draft.value), next)
      if (canonical.length) journal.applyRemote(canonical)
      draft.value.id = result.id
      draft.value.revision = result.revision
      journal.acknowledge(savedVersion)
      lastSavedAt.value = result.changedAt
      onSaved?.(result)
      preview.saved(result)
    } catch (cause) {
      error.value = cause.message
      saveError.value = cause.message
      conflict.value = cause.status === 409
    } finally {
      saving.value = false
      if (dirty.value && !error.value && !stopped) timer = setTimeout(save, 800)
    }
  }
  watch(
    journal.revision,
    () => {
      clearTimeout(timer)
      if (!gesturing.value && !conflict.value) timer = setTimeout(save, 1200)
    },
    { immediate: true },
  )
  function pauseSave(value) {
    gesturing.value = value
    clearTimeout(timer)
    if (!value && !conflict.value && !stopped) timer = setTimeout(save, 1200)
  }
  function receive(model) {
    if (
      !model ||
      model.id !== draft.value.id ||
      dirty.value ||
      saving.value ||
      gesturing.value
    )
      return
    draft.value = clone(model)
    record = { id: model.id, revision: model.revision }
    journal.accept()
    lastSavedAt.value = model.changedAt
    preview.saved(model)
  }
  async function reload() {
    try {
      const result = await reloadMapDocument(draft.value, options.session)
      draft.value = clone(result)
      record = { id: result.id, revision: result.revision }
      journal.accept()
      lastSavedAt.value = result.changedAt
      conflict.value = false
      error.value = saveError.value = ''
      onSaved?.(result)
      preview.saved(result)
    } catch (cause) {
      error.value = saveError.value = cause.message
    }
  }
  function discard() {
    stopped = true
    clearTimeout(timer)
    discardMapDocument(draft.value, options.session)
    journal.acknowledge(journal.revision.value)
  }
  watch(loadingModels, (loading) => {
    if (
      !loading &&
      dirty.value &&
      !gesturing.value &&
      !conflict.value &&
      !stopped
    ) {
      clearTimeout(timer)
      timer = setTimeout(save, 1200)
    }
  })
  function beforeUnload(event) {
    if (dirty.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  window.addEventListener('beforeunload', beforeUnload)
  onBeforeUnmount(() => {
    stopped = true
    clearTimeout(timer)
    window.removeEventListener('beforeunload', beforeUnload)
  })
  return {
    saving,
    error,
    saveError,
    conflict,
    lastSavedAt,
    save,
    reload,
    discard,
    receive,
    pauseSave,
  }
}

import { getCurrentScope, onScopeDispose, ref, watch } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { itemsApi } from '@/shared/api/itemsApi'
import { normalizeContentSourceSettings } from '@/shared/api/contentSourcesApi'
import { CLASS_ITEM_TYPE, RACE_ITEM_TYPE, SUBCLASS_ITEM_TYPE, SUBRACE_ITEM_TYPE, originChildren } from '@/shared/lib/dndItemTypes'
import { backgroundReferenceIds } from '@/features/character-editor/settings/dnd/creation/backgroundEquipment'
const RACE_ABIL_TYPE = 3, CLASS_ABIL_TYPE = 4, SPELL_TYPE = 5, FEAT_TYPE = 7, BG_TYPE = 11

export function useDndCreateCatalog({ state, sourceVersionId, sourceSuffix, equipment, paused }) {
  const races = ref([])
  const allSubraces = ref([])
  const raceSubracesByParent = ref(new Map())
  const classes = ref([])
  const allSubclasses = ref([])
  const classSubclassesByParent = ref(new Map())
  const subraces = ref([])
  const subclasses = ref([])
  const raceAbilities = ref([])
  const classAbilities = ref([])
  const spellPool = ref([])
  const featPool = ref([])
  const bgPool = ref([])
  const loading = ref(false)

  let loadRequest = 0, spellRequest = 0
  let loadedOnce = false
  let scopeReloadTimer = null

  async function load() {
    const current = ++loadRequest
    loading.value = true
    try {
      const [r, sr, c, sc, ra, ca, ft, bg] = await Promise.all([
        fetchGet(`/items?typeId=${RACE_ITEM_TYPE}&limit=300${sourceSuffix()}`),
        fetchGet(`/items?typeId=${SUBRACE_ITEM_TYPE}&limit=300${sourceSuffix()}`),
        fetchGet(`/items?typeId=${CLASS_ITEM_TYPE}&limit=300${sourceSuffix()}`),
        fetchGet(`/items?typeId=${SUBCLASS_ITEM_TYPE}&limit=300${sourceSuffix()}`),
        fetchGet(`/items?typeId=${RACE_ABIL_TYPE}&limit=500${sourceSuffix()}`),
        itemsApi.listAll(CLASS_ABIL_TYPE, { sourceVersionId: sourceVersionId.value, contentSources: { ...state.contentSources, allowLegacy: false } }),
        fetchGet(`/items?typeId=${FEAT_TYPE}&limit=500${sourceSuffix()}`),
        fetchGet(`/items?typeId=${BG_TYPE}&limit=200${sourceSuffix()}`),
        equipment.loadEquipmentCatalogue(),
      ])
      if (current !== loadRequest) return
      races.value = r?.items || []
      allSubraces.value = sr?.items || []
      const subraceMap = new Map()
      races.value.forEach((race) => {
        const names = originChildren(race, allSubraces.value, 'subraces').map(item => item.name).filter(Boolean)
        if (names.length) subraceMap.set(String(race.id), names)
      })
      raceSubracesByParent.value = subraceMap
      classes.value = c?.items || []
      allSubclasses.value = sc?.items || []
      const subclassMap = new Map()
      classes.value.forEach((charClass) => {
        const names = originChildren(charClass, allSubclasses.value, 'subclasses').map(item => item.name).filter(Boolean)
        if (names.length) subclassMap.set(String(charClass.id), names)
      })
      classSubclassesByParent.value = subclassMap
      subraces.value = state.race ? originChildren(state.race, allSubraces.value, 'subraces') : []
      subclasses.value = state.charClass ? originChildren(state.charClass, allSubclasses.value, 'subclasses') : []
      raceAbilities.value = ra?.items || []
      classAbilities.value = ca?.items || []
      featPool.value = ft?.items || []
      bgPool.value = bg?.items || []
      await equipment.ensureEquipmentCatalogueItems(bgPool.value.flatMap(backgroundReferenceIds))
    } finally {
      if (current === loadRequest) loading.value = false
      loadedOnce = true
    }
  }

  watch(
    [sourceVersionId, () => JSON.stringify(normalizeContentSourceSettings(state.contentSources))],
    () => {
      if (paused() || !loadedOnce) return
      clearTimeout(scopeReloadTimer)
      scopeReloadTimer = setTimeout(() => load(), 120)
    },
  )

  watch(() => state.race, (r) => {
    if (paused()) return
    state.subrace = null
    state.raceVariant = null
    subraces.value = []
    if (!r) return
    subraces.value = originChildren(r, allSubraces.value, 'subraces')
  })
  watch(() => state.charClass, (c) => {
    if (paused()) return
    state.subclass = null
    state.skillIds = []
    state.classToolProficiencyIds = []
    state.spellIds = []
    equipment.resetEquipmentForClass()
    subclasses.value = []
    if (!c) return
    subclasses.value = originChildren(c, allSubclasses.value, 'subclasses')
  })
  async function loadSpells() {
    const current = ++spellRequest
    if (!state.charClass) { spellPool.value = []; return }
    const classId = state.charClass.id
    const res = await itemsApi.listAll(SPELL_TYPE, {
      contentSources: { ...state.contentSources, allowLegacy: false },
      sourceVersionId: sourceVersionId.value,
    }, {
      'classes.id': [classId],
      lvl: [0, 1],
    })
    if (current !== spellRequest || classId !== state.charClass?.id) return
    spellPool.value = (res?.items || []).filter((sp) => {
      const lvl = Number(sp.data?.lvl ?? 0)
      if (lvl > 1) return false
      const byItem = (sp.data?.classes || []).some((c) => Number(c?.id) === classId)
      return byItem
    })
  }

  function raceSubraceNames(raceId) { return raceSubracesByParent.value.get(String(raceId)) || [] }
  function classSubclassNames(classId) { return classSubclassesByParent.value.get(String(classId)) || [] }
  if (getCurrentScope()) onScopeDispose(() => clearTimeout(scopeReloadTimer))
  return { races, allSubraces, classes, allSubclasses, subraces, subclasses, raceAbilities, classAbilities, spellPool, featPool, bgPool, loading, load, loadSpells, raceSubraceNames, classSubclassNames }
}

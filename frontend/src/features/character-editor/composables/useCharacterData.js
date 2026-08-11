import { ref, reactive, computed, provide } from 'vue'
import { consumeCharSeed } from '@/shared/lib/charSeed'
import { fetchGet, fetchPut } from '@/shared/api/http'
import { useAccountStore } from '@/stores/account'
import { useTemplateStore } from '@/stores/template'
import { settingAccessors, settingRenderSchema } from '@/features/character-editor/settings'
import { normalizeContentSourceSettings } from '@/shared/api/contentSourcesApi'
import {
  activeLayoutProfile,
  initialTabs,
  layoutNodeToBlock,
  profileTabs,
} from '@/features/character-editor/lib/templateSchema'

const STATUS_PRIORITY = { live: 5, active: 4, planned: 3, paused: 2, draft: 1, completed: 0, archived: -1 }
const ACTIVE_STATUSES = new Set(['live', 'active'])

export function useCharacterData(uuid, isMobile) {
  const loading = ref(true)
  const template = ref(null)
  const accessors = ref(null)
  const data = ref({ values: {}, var: {} })
  const charCtx = reactive({ ownerMode: false, dictionaries: {}, var: {} })
  const sourceVersionId = ref(null)
  const contentSources = computed(() => normalizeContentSourceSettings(data.value.settings?.contentSources))
  const isOwner = ref(false)
  const publicVisible = ref(false)
  const version = ref(0)
  const sessions = ref([])

  provide('charCtx', charCtx)
  Object.assign(charCtx, { sourceVersionId, contentSources })

  function apply(res) {
    if (!res) {
      throw new Error('Empty character response')
    }

    template.value = settingRenderSchema(res.templateName)
    if (!template.value) throw new Error(`Unsupported character template: ${res.templateName}`)
    accessors.value = settingAccessors(res.templateName)
    data.value = { values: {}, var: {}, ...res.data }
    publicVisible.value = res.publicVisible
    version.value = Number(res.version) || 0
    sourceVersionId.value = res.sourceVersionId ?? null
    charCtx.dictionaries = template.value.dictionaries || {}
    charCtx.var = data.value.var || {}

    const currentUserId = useAccountStore().user?.id
    isOwner.value = !!currentUserId && res.userId === currentUserId
    charCtx.ownerMode = isOwner.value
    loading.value = false

    document.title = data.value.values?.name || 'Персонаж'

    return res
  }

  // Build a CharacterResponse-shaped object from the list seed and template name.
  function buildFromSeed() {
    const seed = consumeCharSeed(uuid)
    if (!seed || seed.templateId == null) return null
    const tpl = useTemplateStore().byId(seed.templateId)
    if (!tpl) return null
    return {
      templateName: tpl.name,
      data: seed.data || {},
      publicVisible: seed.publicVisible,
      userId: seed.userId,
      version: seed.version,
      sourceVersionId: seed.sourceVersionId,
    }
  }

  let appliedSeed = null

  function loadSync() {
    // Synchronous seed path: render the page in the same tick so a View Transition
    // can snapshot it with content present. Auth (for edit rights) resolves in the
    // background and only flips `isOwner` afterwards. Idempotent — safe to call from
    // both setup() and load().
    if (appliedSeed) return appliedSeed
    const seedRes = buildFromSeed()
    if (!seedRes) return null
    appliedSeed = apply(seedRes)
    useAccountStore().ensureAuth().then(() => {
      const currentUserId = useAccountStore().user?.id
      isOwner.value = !!currentUserId && seedRes.userId === currentUserId
      charCtx.ownerMode = isOwner.value
    })
    return appliedSeed
  }

  async function load() {
    const fromSeed = loadSync()
    if (fromSeed) return fromSeed
    if (!uuid) return null
    await useAccountStore().ensureAuth()
    const res = await fetchGet('/char/' + uuid)
    return apply(res)
  }

  const layout = computed(() => activeLayoutProfile(template.value, isMobile.value))

  const activeTabs = computed(() => {
    const layouts = template.value?.layouts || {}
    if (isMobile.value && layouts.mobile) return profileTabs(layouts.mobile)
    return profileTabs(layouts.desktop)
  })

  const toolbarTabs = computed(() =>
    !isMobile.value && activeTabs.value.length > 1 ? activeTabs.value : []
  )

  const mobileTabs = computed(() =>
    isMobile.value && activeTabs.value.length > 1 ? activeTabs.value : []
  )

  const headerTitle = computed(() => accessors.value?.headerTitle(data.value) || '')
  const charName = computed(() => accessors.value?.displayName(data.value) || '')
  const charSub = computed(() => accessors.value?.subtitle(data.value) || '')

  const toolbarBlocksList = computed(() => {
    const blocks = layout.value?.toolbar_blocks
    if (!Array.isArray(blocks) || !template.value) return null
    return blocks.map(node => layoutNodeToBlock(node, template.value)).filter(Boolean)
  })

  const commonMobileBlockNode = computed(() => {
    const node = layout.value?.common_mobile_blocks
    if (!node || !template.value || !isMobile.value) return null
    return layoutNodeToBlock(node, template.value)
  })

  const commonMobileScrollHide = computed(() =>
    !!layout.value?.common_mobile_blocks_scroll_hide
  )

  const tabBlockCache = ref({})

  function blocksForTab(index) {
    if (tabBlockCache.value[index]) return tabBlockCache.value[index]
    const tab = activeTabs.value[index]
    const blocks = tab?.content ? [layoutNodeToBlock(tab.content, template.value)] : []
    tabBlockCache.value[index] = blocks
    return blocks
  }

  function containerWidthForTab(index) {
    const tab = activeTabs.value[index]
    const w = tab?.width ?? template.value?.common?.width ?? layout.value?.width
    return w ? { maxWidth: w + 'px' } : {}
  }

  function getInitialTabs() {
    return initialTabs(template.value)
  }

  function updateValue({ id, value }) {
    data.value = { ...data.value, values: { ...data.value.values, [id]: value } }
    if (id === 'name' && value) document.title = value
  }

  function updateVar(patch) {
    const current = data.value.var || {}
    data.value = {
      ...data.value,
      var: {
        ...current,
        ...patch,
        stats: patch.stats ? { ...(current.stats || {}), ...patch.stats } : current.stats,
      },
    }
    charCtx.var = data.value.var
  }

  function updateContentSources(value) {
    data.value = {
      ...data.value,
      settings: {
        ...(data.value.settings || {}),
        contentSources: normalizeContentSourceSettings(value),
      },
    }
  }

  function onPublicToggle(val) {
    publicVisible.value = val
    fetchPut('/char/' + uuid + '/public', { publicVisible: val })
      .catch(() => { publicVisible.value = !val })
  }

  async function loadSessions() {
    if (!isOwner.value) { sessions.value = []; return }
    try {
      const res = await fetchGet('/char/' + uuid + '/sessions')
      sessions.value = (res?.sessions || []).slice().sort((a, b) => {
        const pa = STATUS_PRIORITY[a.status] ?? -2
        const pb = STATUS_PRIORITY[b.status] ?? -2
        return pb - pa
      })
    } catch { /* ignore */ }
  }

  const topSession = computed(() => sessions.value[0] || null)
  const hasActiveSession = computed(() =>
    sessions.value.some(s => ACTIVE_STATUSES.has(s.status))
  )

  async function pollVersion() {
    try {
      const res = await fetchGet('/char/' + uuid + '/version')
      return Number(res?.version) || 0
    } catch { return version.value }
  }

  async function refreshFromServer() {
    try {
      const res = await fetchGet('/char/' + uuid)
      if (!res) return false
      data.value = { values: {}, var: {}, ...res.data }
      version.value = Number(res.version) || 0
      sourceVersionId.value = res.sourceVersionId ?? sourceVersionId.value
      charCtx.var = data.value.var || {}
      document.title = data.value.values?.name || 'Персонаж'
      return true
    } catch { return false }
  }

  function invalidateTabCache() {
    tabBlockCache.value = {}
  }

  return {
    loading,
    template,
    data,
    charCtx,
    sourceVersionId,
    contentSources,
    isOwner,
    publicVisible,
    version,
    sessions,
    topSession,
    hasActiveSession,
    loadSessions,
    pollVersion,
    refreshFromServer,
    activeTabs,
    toolbarTabs,
    mobileTabs,
    headerTitle,
    charName,
    charSub,
    toolbarBlocksList,
    commonMobileBlockNode,
    commonMobileScrollHide,
    load,
    loadSync,
    blocksForTab,
    containerWidthForTab,
    getInitialTabs,
    updateValue,
    updateVar,
    updateContentSources,
    onPublicToggle,
    invalidateTabCache,
  }
}

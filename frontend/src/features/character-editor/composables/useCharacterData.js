import { ref, reactive, computed, provide } from 'vue'
import { consumeCharSeed } from '@/shared/lib/charSeed'
import { fetchGet, fetchPut } from '@/shared/api/http'
import { useAccountStore } from '@/stores/account'
import { useTemplateStore } from '@/stores/template'
import { settingAccessors, settingRenderSchema } from '@/features/character-editor/settings'
import { normalizeContentSourceSettings } from '@/shared/api/contentSourcesApi'
import { useCharacterResources } from '@/features/character-editor/composables/useCharacterResources'
import {
  activeLayoutProfile,
  initialTabs,
  layoutNodeToBlock,
  profileTabs,
} from '@/features/character-editor/lib/templateSchema'

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
  const iconImageId = ref(null)
  const iconImageUrl = ref(null)
  const sessions = ref([])
  const characterValues = computed(() => data.value.values || {})
  const characterResources = useCharacterResources(characterValues)

  provide('charCtx', charCtx)
  Object.assign(charCtx, {
    sourceVersionId,
    contentSources,
    iconImageId,
    iconImageUrl,
    uploadCharacterIcon,
    characterResources,
  })

  function apply(res, { updateDocumentTitle = true } = {}) {
    if (!res) {
      throw new Error('Empty character response')
    }

    template.value = settingRenderSchema(res.templateName)
    if (!template.value) throw new Error(`Unsupported character template: ${res.templateName}`)
    accessors.value = settingAccessors(res.templateName)
    data.value = { values: {}, var: {}, ...res.data }
    publicVisible.value = res.publicVisible
    version.value = Number(res.version) || 0
    iconImageId.value = res.iconImageId ?? null
    iconImageUrl.value = res.iconImageUrl ?? null
    sourceVersionId.value = res.sourceVersionId ?? null
    charCtx.dictionaries = template.value.dictionaries || {}
    charCtx.var = data.value.var || {}

    const currentUserId = useAccountStore().user?.id
    isOwner.value = !!currentUserId && res.userId === currentUserId
    charCtx.ownerMode = isOwner.value
    loading.value = false

    if (updateDocumentTitle) document.title = data.value.values?.name || 'Персонаж'

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
      iconImageId: seed.iconImageId,
      iconImageUrl: seed.iconImageUrl,
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

  function loadPreview(preview) {
    return apply(preview, { updateDocumentTitle: false })
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
    updateValues({ [id]: value })
  }

  function updateValues(patch) {
    data.value = { ...data.value, values: { ...data.value.values, ...(patch || {}) } }
    if (patch?.name) document.title = patch.name
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
      sessions.value = (res?.sessions || []).slice(0, 1)
    } catch { /* ignore */ }
  }

  const topSession = computed(() => sessions.value[0] || null)
  const hasSessionContext = computed(() => sessions.value.length > 0)

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
      iconImageId.value = res.iconImageId ?? null
      iconImageUrl.value = res.iconImageUrl ?? null
      sourceVersionId.value = res.sourceVersionId ?? sourceVersionId.value
      charCtx.var = data.value.var || {}
      document.title = data.value.values?.name || 'Персонаж'
      return true
    } catch { return false }
  }

  async function uploadCharacterIcon(file) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`/api/char/${uuid}/icon-image`, { method: 'POST', body: formData })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload?.desc || String(response.status))
    }
    const result = await response.json()
    iconImageId.value = result.iconImageId ?? null
    iconImageUrl.value = result.iconImageUrl ?? null
    return result
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
    iconImageId,
    iconImageUrl,
    sessions,
    topSession,
    hasSessionContext,
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
    loadPreview,
    loadSync,
    blocksForTab,
    containerWidthForTab,
    getInitialTabs,
    updateValue,
    updateValues,
    updateVar,
    updateContentSources,
    onPublicToggle,
    invalidateTabCache,
  }
}

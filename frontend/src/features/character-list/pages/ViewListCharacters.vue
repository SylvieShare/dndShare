<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">Персонажи</h1>
      <button class="create-btn" type="button" @click="openCreateModal">
        <span class="create-btn-plus" aria-hidden="true">+</span>
        Новый персонаж
      </button>
    </div>

    <div v-if="loading" class="chars-grid">
      <div v-for="n in 2" :key="n" class="char-skeleton">
        <div class="sk-ava" />
        <div class="sk-lines">
          <div class="sk-line sk-name" />
          <div class="sk-line sk-who" />
          <div class="sk-line sk-meta" />
        </div>
      </div>
    </div>

    <template v-else>
      <section v-for="group in groupedChars" :key="group.key" class="char-section">
        <div class="char-section-head">
          <h2 class="char-section-title">{{ group.name }}</h2>
          <span class="char-section-count">{{ group.chars.length }}</span>
        </div>
        <div class="chars-grid">
          <CharBox
            v-for="char in group.chars"
            :key="char.uuid"
            :uuid="char.uuid"
            :data="char.data"
            :raw="char"
            :templateName="templateName(char.templateId)"
            :sourceVersion="char.sourceVersion"
            :accessors="accessorsFor(char.templateId)"
            :session="topSession(char.uuid)"
            :publicVisible="char.publicVisible"
            :changedAt="char.changedAt"
            @clone="cloneChar"
            @delete="deleteChar"
          />
        </div>
      </section>
    </template>

    <CharacterCreateModal
      v-if="showModal"
      :templates="templates"
      :creating="creating"
      :origin-rect="createOriginRect"
      :origin-el="createOriginEl"
      @close="closeCreateModal"
      @create="createChar"
    />
  </div>
</template>

<script>
// Named so App.vue's <keep-alive include="ViewListCharacters"> can cache the list
// across expand-from-tile navigations (tiles stay mounted for the VT snapshots).
export default { name: 'ViewListCharacters' }
</script>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CharBox from "@/features/character-list/components/CharBox"
import CharacterCreateModal from "@/features/character-list/components/CharacterCreateModal"
import { consumePrefetch } from '@/app/router'
import { fetchGet, fetchPost, fetchDelete } from '@/shared/api/http'
import { resolveSetting, settingAccessors } from '@/features/character-editor/settings'
import { useTemplateStore } from '@/stores/template'

const router = useRouter()
const route = useRoute()
const templateStore = useTemplateStore()
const chars = ref([])
const sessionsByChar = ref({})
const loading = ref(true)
const showModal = ref(false)
const creating = ref(false)
const createOriginEl = ref(null)
const createOriginRect = ref(null)
const templates = computed(() => templateStore.all)
const groupedChars = computed(() => {
  const groups = new Map()
  for (const char of chars.value) {
    const key = char.sourceId != null ? `source:${char.sourceId}` : 'source:unknown'
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: char.sourceName || 'Без системы',
        sourceId: char.sourceId ?? null,
        chars: [],
      })
    }
    groups.get(key).chars.push(char)
  }
  return [...groups.values()].sort((a, b) => {
    if (a.sourceId == null) return 1
    if (b.sourceId == null) return -1
    return a.name.localeCompare(b.name, 'ru')
  })
})

function loadChars(preFetched) {
  loading.value = true
  const promise = preFetched || fetchGet('/chars')
  promise.then(res => {
    chars.value = res?.chars || []
    sessionsByChar.value = res?.sessionsByChar || {}
    loading.value = false
  })
}

function templateById(id) {
  return templates.value.find(t => t.id === id) || null
}

function templateName(id) {
  return templateById(id)?.name || ''
}

function accessorsFor(id) {
  // Identity is resolved from the template's `name` (see settings/index.js), so
  // pass the whole template — the DB `schema` is no longer consulted here.
  return settingAccessors(templateById(id))
}

function topSession(uuid) {
  return sessionsByChar.value[uuid]?.[0] || null
}

function openCreateModal(e) {
  // D&D creation has a dedicated full-page wizard; other registered systems use the compact modal.
  const dnd = templates.value.find(t => resolveSetting(t)?.system === 'dnd5e')
  if (dnd) { router.push('/chars/new'); return }
  const el = e?.currentTarget || null
  createOriginEl.value = el
  if (el) {
    const r = el.getBoundingClientRect()
    createOriginRect.value = { left: r.left, top: r.top, width: r.width, height: r.height }
  }
  showModal.value = true
}

function closeCreateModal() {
  showModal.value = false
}

async function createChar(payload) {
  if (creating.value) return
  creating.value = true
  try {
    const res = await fetchPost('/chars', payload)
    showModal.value = false
    router.push('/char/' + res.uuid)
  } finally {
    creating.value = false
  }
}

async function cloneChar(uuid) {
  await fetchPost('/char/' + uuid + '/clone', null)
  loadChars()
}

async function deleteChar(uuid) {
  await fetchDelete('/char/' + uuid)
  chars.value = chars.value.filter(c => c.uuid !== uuid)
}

onMounted(() => {
  loadChars(consumePrefetch(route.fullPath))
  templateStore.ensure()
})
</script>

<style scoped>
.page {
  padding: 24px;
  min-height: calc(100vh - var(--header-h));
  max-width: 1400px;
  margin: 0 auto;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-1, var(--text-on-accent));
  margin: 0;
}

.create-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 34px;
  padding: 0 13px;
  border: 0;
  border-radius: 9px;
  background: var(--accent);
  color: var(--text-on-accent);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: filter 0.15s, transform 0.15s;
}

.create-btn:hover {
  filter: brightness(1.1);
}

.create-btn:active {
  transform: translateY(1px);
}

.create-btn-plus {
  font-size: 18px;
  font-weight: 500;
  line-height: 1;
}

.chars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(440px, 1fr));
  gap: 16px;
}

.char-section + .char-section {
  margin-top: 28px;
}

.char-section-head {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 10px;
}

.char-section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-2);
}

.char-section-count {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  color: var(--accent-soft);
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}

.char-skeleton {
  height: 124px;
  background: var(--surface);
  border-radius: var(--r-lg);
  display: flex;
  align-items: stretch;
  overflow: hidden;
  box-sizing: border-box;
}

.sk-ava {
  flex-shrink: 0;
  width: 96px;
  align-self: stretch;
  background: var(--surface-raised);
  animation: sk-pulse 1.4s ease-in-out infinite;
}

.sk-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 12px 14px;
}

.sk-line {
  height: 10px;
  border-radius: 5px;
  background: var(--surface-raised);
  animation: sk-pulse 1.4s ease-in-out infinite;
}

.sk-name  { width: 60%; animation-delay: 0.1s; }
.sk-who   { width: 80%; animation-delay: 0.2s; }
.sk-meta  { width: 40%; animation-delay: 0.3s; }

@keyframes sk-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

@media (max-width: 640px) {
  .page {
    padding: 16px 12px;
  }

  .chars-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

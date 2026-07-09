<template>
  <BaseTile class="char-card" @click="navigate">
    <CharStatRadar v-if="radarAxes" class="char-radar" :axes="radarAxes" />

    <div class="char-ava">
      <img v-if="avaUrl" :src="avaUrl" class="ava-img" alt="" />
      <div v-else class="ava-placeholder" />
    </div>

    <div class="char-body">
      <div class="char-info">
        <div class="char-name">{{ displayName }}</div>
        <div v-if="who" class="char-who">{{ who }}</div>
        <div class="char-meta">
          <span v-if="lvl" class="meta-lvl">Ур.&nbsp;{{ lvl }}</span>
          <span v-if="templateName" class="meta-template">{{ templateName }}</span>
          <span v-if="relativeDate" class="meta-date">{{ relativeDate }}</span>
        </div>
      </div>

      <div v-if="session" class="char-session">
        <span class="session-dot" :style="{ background: statusColor(session.status) }" />
        <span class="session-name">{{ session.name }}</span>
        <span v-if="chapterLabel" class="session-chapter">{{ chapterLabel }}</span>
      </div>
    </div>

    <button ref="menuBtnEl" class="menu-btn" @click.stop="toggleMenu" title="Действия">⋯</button>

    <BasePopover v-model:open="menuOpen" :anchor="menuBtnEl" placement="bottom-end" :min-width="148">
      <div class="dropdown-item" @click="doClone">Клонировать</div>
      <div class="dropdown-sep" />
      <div class="dropdown-item danger" @click="startDelete">Удалить</div>
    </BasePopover>

    <ConfirmDialog
      v-if="confirmDelete"
      title="Удалить персонажа?"
      :message="displayName"
      confirm-label="Удалить"
      variant="danger"
      @cancel="cancelDelete"
      @confirm="doDelete"
    />
  </BaseTile>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BasePopover from '@/shared/ui/BasePopover.vue'
import BaseTile from '@/shared/ui/BaseTile'
import CharStatRadar from '@/features/character-list/components/CharStatRadar.vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog'
import { setCharSeed } from '@/shared/lib/charSeed'
import { useSuggestStore } from '@/stores/suggest'

const ABILITY_SUGGEST_TYPE = 16

const STATUS_COLOR = {
  live: '#e85c5c', active: '#5ce87c', planned: '#5c95e8', paused: '#e89c3c',
  completed: '#707080', draft: 'var(--text-muted)', archived: 'var(--text-muted)',
}

function getByPath(obj, path) {
  if (!obj || !path) return null
  return path.split('.').reduce((cur, key) => (cur != null ? cur[key] : null), obj)
}

function toStr(val) {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') return ''
  return String(val)
}

const props = defineProps({
  uuid: String,
  data: { type: Object, default: () => ({}) },
  raw: { type: Object, default: null },
  templateName: String,
  // D&D semantic accessors (see settings/dnd/accessors.js). When present the card
  // reads fields + ability radar through them; otherwise it falls back to the
  // legacy per-template `pathValues`.
  accessors: { type: Object, default: null },
  pathValues: { type: Object, default: null },
  session: { type: Object, default: null },
  publicVisible: { type: Boolean, default: true },
  changedAt: String,
})
const emit = defineEmits(['clone', 'delete'])

const router = useRouter()
const suggestStore = useSuggestStore()
const menuOpen = ref(false)
const menuBtnEl = ref(null)
const confirmDelete = ref(false)

const displayName = computed(() => {
  if (props.accessors) return props.accessors.displayName(props.data) || '(без имени)'
  return toStr(getByPath(props.data, props.pathValues?.name)) || '(без имени)'
})
const avaUrl = computed(() => {
  if (props.accessors) return props.accessors.avatar(props.data)
  const value = getByPath(props.data, props.pathValues?.ava)
  if (typeof value === 'string') return value
  if (value?.url) return value.url
  return null
})
const who = computed(() => {
  if (props.accessors) return props.accessors.subtitle(props.data)
  const w1 = toStr(getByPath(props.data, props.pathValues?.who_1))
  const w2 = toStr(getByPath(props.data, props.pathValues?.who_2))
  return [w1, w2].filter(Boolean).join(' · ')
})
const lvl = computed(() => {
  if (props.accessors) return toStr(props.accessors.level(props.data))
  return toStr(getByPath(props.data, props.pathValues?.lvl))
})

const radarAxes = computed(() => {
  if (!props.accessors?.abilities) return null
  const abilities = props.accessors.abilities(props.data)
  if (!abilities.length) return null
  return abilities.map(a => {
    const suggest = suggestStore.items(a.suggestTypeId).find(s => String(s.id) === String(a.titleSuggestId))
    return { id: a.id, score: a.score, svg: suggest?.svg || '', color: suggest?.color || '' }
  })
})

const chapterLabel = computed(() => {
  const s = props.session
  if (!s) return ''
  const num = s.chapterNumber != null ? `Гл. ${s.chapterNumber}` : ''
  return [num, s.chapterName].filter(Boolean).join(' · ')
})

function statusColor(status) { return STATUS_COLOR[status] || 'var(--text-muted)' }

const relativeDate = computed(() => {
  if (!props.changedAt) return ''
  const diffMs = Date.now() - new Date(props.changedAt).getTime()
  const m = Math.floor(diffMs / 60000)
  const h = Math.floor(diffMs / 3600000)
  const d = Math.floor(diffMs / 86400000)
  if (m < 2) return 'только что'
  if (m < 60) return `${m} мин назад`
  if (h < 24) return `${h} ч назад`
  if (d < 7) return `${d} дн назад`
  return new Date(props.changedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
})

function navigate() {
  // Seed the character so the page renders synchronously (no fetch flash).
  if (props.raw) {
    setCharSeed(props.uuid, {
      data: props.raw.data,
      version: props.raw.version,
      userId: props.raw.userId,
      publicVisible: props.raw.publicVisible,
      templateId: props.raw.templateId,
    })
  }
  router.push('/char/' + props.uuid)
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function doClone() {
  menuOpen.value = false
  emit('clone', props.uuid)
}

function startDelete() {
  menuOpen.value = false
  confirmDelete.value = true
}

function cancelDelete() {
  confirmDelete.value = false
}

function doDelete() {
  confirmDelete.value = false
  emit('delete', props.uuid)
}

// Accessors arrive once the template store loads (possibly after mount), so load
// the ability-icon suggests as soon as a D&D character is in play.
watch(
  () => !!props.accessors?.abilities,
  hasAbilities => { if (hasAbilities) suggestStore.ensure(ABILITY_SUGGEST_TYPE) },
  { immediate: true },
)
</script>

<style scoped>
/* Surface (background, radius, position) comes from BaseTile; this owns the
   card's own layout + hover. */
.char-card {
  height: 124px;
  display: flex;
  align-items: stretch;
  cursor: pointer;
  overflow: hidden;
  transition: box-shadow 0.2s, background 0.2s;
}

.char-card:hover {
  background: #242838;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent);
}

/* Flush to the container — no padding, fills the full height of the card. */
.char-ava {
  flex-shrink: 0;
  width: 96px;
  align-self: stretch;
}

.ava-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
  display: block;
}

.ava-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #482f6c, #623cd7);
}

.char-radar {
  align-self: center;
}

.char-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
}

.char-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.char-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--warning);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 26px;
}

.char-who {
  font-size: 12px;
  color: #a0a0b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.char-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.meta-lvl {
  font-size: 11px;
  font-weight: 600;
  background: #2e1d5c;
  color: #c4a0ff;
  border-radius: 5px;
  padding: 1px 7px;
}

.meta-template {
  font-size: 11px;
  color: var(--text-muted);
}

.meta-date {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: auto;
  white-space: nowrap;
}

.char-session {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.session-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.session-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-chapter {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.menu-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 7px;
  color: var(--text-muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s, color 0.15s;
}

.menu-btn:hover {
  background: #26263a;
  color: #a0a0cc;
}

.dropdown-item {
  padding: 9px 14px;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: #242438;
}

.dropdown-item.danger {
  color: #d85555;
}

.dropdown-item.danger:hover {
  background: #281818;
}

.dropdown-sep {
  height: 1px;
  background: #2a2a3e;
  margin: 2px 0;
}
</style>

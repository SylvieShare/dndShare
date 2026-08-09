<template>
  <div class="join-page">
    <div v-if="loading" class="join-loading">
      <div class="sk-hero" />
      <div class="sk-row" />
      <div class="sk-row" />
    </div>

    <div v-else-if="error === 'auth'" class="join-state">
      <div class="state-card">
        <div class="state-emoji">🔒</div>
        <h2 class="state-title">Нужно войти</h2>
        <p class="state-text">Чтобы вступить в приключение, войдите в свой аккаунт.</p>
        <router-link to="/" class="state-btn">На главную</router-link>
      </div>
    </div>

    <div v-else-if="error === 'notfound'" class="join-state">
      <div class="state-card">
        <div class="state-emoji">🗺️</div>
        <h2 class="state-title">Сессия не найдена</h2>
        <p class="state-text">Проверьте ссылку у мастера — возможно, код устарел.</p>
        <router-link to="/sessions" class="state-btn">К моим сессиям</router-link>
      </div>
    </div>

    <template v-else-if="session">
      <section class="hero">
        <div class="hero-inner">
          <div class="hero-meta">
            <span class="hero-eyebrow">Приглашение в приключение</span>
            <span class="hero-status" :style="{ '--status-color': sessionStatusColor(session.status) }">
              {{ sessionStatusLabel(session.status) }}
            </span>
          </div>
          <h1 class="hero-title">{{ session.name }}</h1>
          <div v-if="session.chapterNumber != null || session.systemName" class="hero-pills">
            <span v-if="session.chapterNumber != null" class="hero-chip hero-chip--chapter">
              <span class="chip-roman">{{ romanNum(session.chapterNumber) }}</span>
              <span v-if="session.chapterName">{{ session.chapterName }}</span>
            </span>
            <span v-if="session.systemName" class="hero-chip">{{ session.systemName }}</span>
          </div>
          <p v-if="session.description" class="hero-desc">{{ session.description }}</p>
        </div>
        <div class="hero-glow" />
      </section>

      <section class="picker">
        <div class="picker-header">
          <h2 class="picker-title">Выбери персонажа для вступления</h2>
          <p class="picker-sub">Клик по карточке — и ты в игре.</p>
        </div>

        <div v-if="loadingChars" class="chars-grid">
          <div v-for="n in 3" :key="n" class="char-skeleton" />
        </div>

        <div v-else-if="chars.length" class="chars-grid">
          <button
            v-for="char in chars"
            :key="char.uuid"
            class="char-tile"
            :class="{ joining: joiningId === char.id }"
            :disabled="!!joiningId"
            @click="selectChar(char)"
          >
            <div class="tile-ava">
              <img v-if="avaUrl(char)" :src="avaUrl(char)" class="ava-img" alt="" />
              <div v-else class="ava-placeholder">
                <span class="ava-letter">{{ initial(char) }}</span>
              </div>
            </div>
            <div class="tile-info">
              <div class="tile-name">{{ displayName(char) }}</div>
              <div v-if="who(char)" class="tile-who">{{ who(char) }}</div>
              <div class="tile-meta">
                <span v-if="lvl(char)" class="meta-lvl">Ур.&nbsp;{{ lvl(char) }}</span>
                <span v-if="templateName(char.templateId)" class="meta-tpl">{{ templateName(char.templateId) }}</span>
              </div>
            </div>
            <span class="tile-arrow">→</span>
          </button>

          <button class="char-tile char-tile--create" :disabled="!!joiningId" @click="openCreate">
            <div class="create-icon">+</div>
            <div class="create-label">Создать нового</div>
          </button>
        </div>

        <div v-else class="no-chars">
          <p>Нет ни одного персонажа. Создай его, чтобы войти.</p>
          <button class="state-btn" :disabled="!!joiningId" @click="openCreate">+ Создать персонажа</button>
        </div>
      </section>
    </template>

    <CharacterCreateModal
      v-if="createOpen"
      :templates="templates"
      :creating="creating"
      @close="createOpen = false"
      @create="createChar"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CharacterCreateModal from '@/features/character-list/components/CharacterCreateModal'
import { fetchGet, fetchPost } from '@/shared/api/http'
import { getSessionByCode, joinSession } from '@/shared/api/sessionsApi'
import { useAccountStore } from '@/stores/account'
import { pvAvatar, pvLevel, pvName, pvSubtitle } from '@/features/sessions/lib/participantView'
import { useTemplateStore } from '@/stores/template'
import { sessionStatusColor, sessionStatusLabel } from '@/features/sessions/composables/useSessionStatus'

const route = useRoute()
const router = useRouter()
const accountStore = useAccountStore()
const templateStore = useTemplateStore()

const code = String(route.params.code || '')

const loading = ref(true)
const loadingChars = ref(false)
const error = ref(null)
const session = ref(null)
const chars = ref([])
const joiningId = ref(null)

const createOpen = ref(false)
const creating = ref(false)
const templates = computed(() => templateStore.all)

const ROMAN = ['', 'I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX']
function romanNum(n) {
  const i = Number(n)
  return ROMAN[i] || (i > 20 ? String(i) : '')
}

function templateName(templateId) {
  return templateStore.all.find(t => t.id === templateId)?.name ?? ''
}
function displayName(char) {
  return pvName(char) || '(без имени)'
}
function initial(char) { return (displayName(char)[0] || '?').toUpperCase() }
function avaUrl(char) {
  return pvAvatar(char)
}
function who(char) {
  return pvSubtitle(char)
}
function lvl(char) {
  return pvLevel(char)
}

async function loadChars() {
  loadingChars.value = true
  try {
    const [res] = await Promise.all([fetchGet('/chars'), templateStore.ensure()])
    chars.value = res?.chars ?? []
  } finally {
    loadingChars.value = false
  }
}

async function selectChar(char) {
  if (joiningId.value) return
  joiningId.value = char.id
  try {
    await joinSession(session.value.uuid, char.id)
    router.push('/char/' + char.uuid)
  } finally {
    joiningId.value = null
  }
}

function openCreate() {
  templateStore.ensure()
  createOpen.value = true
}

async function createChar(payload) {
  if (creating.value) return
  creating.value = true
  try {
    const res = await fetchPost('/chars', payload)
    if (res?.charId != null) {
      await joinSession(session.value.uuid, res.charId).catch(() => {})
      createOpen.value = false
      router.push('/char/' + res.uuid)
    }
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  try {
    const user = await accountStore.checkAuth()
    if (!user || !user.id) {
      error.value = 'auth'
      return
    }
    const res = await getSessionByCode(code).catch(() => null)
    if (!res || !res.uuid) {
      error.value = 'notfound'
      return
    }
    session.value = res
    loadChars()
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.join-page {
  min-height: calc(100vh - var(--header-h));
  padding: 32px 20px 64px;
  max-width: 980px;
  margin: 0 auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.join-loading { display: flex; flex-direction: column; gap: 14px; }
.sk-hero { height: 180px; border-radius: 18px; background: var(--bg); animation: sk-pulse 1.4s ease-in-out infinite; }
.sk-row { height: 64px; border-radius: 12px; background: var(--bg); animation: sk-pulse 1.4s ease-in-out infinite; }

.join-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 40px;
}
.state-card {
  background: var(--bg);
  border: 1px solid var(--surface-raised);
  border-radius: 16px;
  padding: 32px 28px;
  text-align: center;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.state-emoji { font-size: 40px; }
.state-title { font-size: 18px; font-weight: 700; color: var(--text-1); margin: 0; }
.state-text { font-size: 13px; color: var(--text-2); margin: 0 0 8px; }
.state-btn {
  background: var(--accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 8px;
  padding: 10px 18px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
}
.state-btn:hover { opacity: 0.9; }
.state-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.hero {
  position: relative;
  border-radius: 22px;
  overflow: hidden;
  border: 1px solid var(--surface-raised);
  background: linear-gradient(135deg, var(--popover-bg) 0%, var(--bg) 70%);
  padding: 36px 32px 32px;
}
.hero-glow {
  position: absolute;
  top: -120px;
  right: -120px;
  width: 360px;
  height: 360px;
  background: radial-gradient(circle, color-mix(in srgb, var(--accent) 35%, transparent), transparent 65%);
  pointer-events: none;
}
.hero-inner { position: relative; display: flex; flex-direction: column; gap: 10px; }
.hero-meta { display: flex; align-items: center; gap: 10px; }
.hero-eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: var(--text-muted);
  text-transform: uppercase;
}
.hero-status {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  border: 1px solid;
  border-color: color-mix(in srgb, var(--status-color) 34%, transparent);
  background: color-mix(in srgb, var(--status-color) 13%, transparent);
  color: var(--status-color);
  border-radius: 5px;
  padding: 3px 8px;
  text-transform: uppercase;
}
.hero-title {
  font-family: var(--font-display, inherit);
  font-size: 38px;
  font-weight: 700;
  color: var(--text-1);
  margin: 4px 0 6px;
  line-height: 1.1;
}
.hero-pills { display: flex; flex-wrap: wrap; gap: 8px; }
.hero-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 32%, transparent);
  color: var(--text-1);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
}
.hero-chip--chapter { background: color-mix(in srgb, var(--accent) 18%, transparent); }
.chip-roman {
  font-family: var(--font-display, inherit);
  font-weight: 800;
  color: var(--accent-soft);
}
.hero-desc {
  margin: 8px 0 0;
  color: var(--text-2);
  font-size: 14px;
  line-height: 1.45;
  max-width: 720px;
  white-space: pre-wrap;
}

.picker { display: flex; flex-direction: column; gap: 16px; }
.picker-header { display: flex; flex-direction: column; gap: 4px; }
.picker-title { font-size: 18px; font-weight: 700; color: var(--text-1); margin: 0; }
.picker-sub { font-size: 13px; color: var(--text-muted); margin: 0; }

.chars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.char-skeleton {
  height: 92px;
  border-radius: 14px;
  background: var(--bg);
  animation: sk-pulse 1.4s ease-in-out infinite;
}

.char-tile {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg);
  border: 1px solid var(--surface-raised);
  border-radius: 14px;
  padding: 12px 14px;
  cursor: pointer;
  font: inherit;
  text-align: left;
  color: inherit;
  transition: border-color 0.15s, background 0.15s, transform 0.08s;
}
.char-tile:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  background: var(--popover-bg);
}
.char-tile:active:not(:disabled) { transform: translateY(1px); }
.char-tile.joining,
.char-tile:disabled { opacity: 0.5; cursor: not-allowed; }

.tile-ava {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(135deg, var(--surface-raised), var(--bg));
  display: flex;
  align-items: center;
  justify-content: center;
}
.ava-img { width: 100%; height: 100%; object-fit: cover; object-position: center 15%; }
.ava-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--accent-hover), var(--surface-raised));
}
.ava-letter { font-size: 22px; font-weight: 700; color: var(--text-on-accent); }

.tile-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.tile-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tile-who { font-size: 11px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tile-meta { display: flex; gap: 6px; flex-wrap: wrap; }
.meta-lvl {
  font-size: 10px;
  font-weight: 700;
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  color: var(--accent-soft);
  border-radius: 4px;
  padding: 1px 6px;
}
.meta-tpl { font-size: 10px; color: var(--text-muted); }

.tile-arrow {
  flex-shrink: 0;
  font-size: 18px;
  color: color-mix(in srgb, var(--accent) 60%, transparent);
  transition: transform 0.15s, color 0.15s;
}
.char-tile:hover:not(:disabled) .tile-arrow { color: var(--accent); transform: translateX(3px); }

.char-tile--create {
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  border-style: dashed;
  border-color: var(--surface-active);
  background: transparent;
  min-height: 92px;
}
.char-tile--create:hover:not(:disabled) {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}
.create-icon { font-size: 26px; color: var(--accent); line-height: 1; }
.create-label { font-size: 12px; color: var(--text-muted); font-weight: 600; }

.no-chars {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 28px 16px;
  background: var(--bg);
  border: 1px dashed var(--surface-raised);
  border-radius: 14px;
  color: var(--text-2);
  font-size: 13px;
  text-align: center;
}

@keyframes sk-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@media (max-width: 640px) {
  .join-page { padding: 20px 14px 48px; gap: 20px; }
  .hero { padding: 24px 20px 22px; border-radius: 18px; }
  .hero-title { font-size: 28px; }
}
</style>

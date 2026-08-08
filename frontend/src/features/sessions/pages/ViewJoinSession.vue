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
            <span class="hero-status" :style="{ background: statusColor(session.status) + '22', color: statusColor(session.status), borderColor: statusColor(session.status) + '55' }">
              {{ statusLabel(session.status) }}
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

const STATUS_CFG = {
  live:      { label: 'Идёт игра',   color: '#e85c5c' },
  active:    { label: 'Активна',     color: '#5ce87c' },
  planned:   { label: 'Запланована', color: '#5c95e8' },
  paused:    { label: 'Пауза',       color: '#e89c3c' },
  completed: { label: 'Завершено',   color: '#707080' },
  draft:     { label: 'Черновик',    color: '#888' },
  archived:  { label: 'Архив',       color: '#888' },
}
function statusLabel(s) { return STATUS_CFG[s]?.label || s || '' }
function statusColor(s) { return STATUS_CFG[s]?.color || '#888' }

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
.sk-hero { height: 180px; border-radius: 18px; background: #1a1a22; animation: sk-pulse 1.4s ease-in-out infinite; }
.sk-row { height: 64px; border-radius: 12px; background: #1a1a22; animation: sk-pulse 1.4s ease-in-out infinite; }

.join-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 40px;
}
.state-card {
  background: #1a1a22;
  border: 1px solid #2a2a38;
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
  color: #fff;
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
  border: 1px solid #2a2a3c;
  background: linear-gradient(135deg, #1c1830 0%, #161620 70%);
  padding: 36px 32px 32px;
}
.hero-glow {
  position: absolute;
  top: -120px;
  right: -120px;
  width: 360px;
  height: 360px;
  background: radial-gradient(circle, rgba(124,92,255,0.35), transparent 65%);
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
  background: rgba(124,92,255,0.12);
  border: 1px solid rgba(124,92,255,0.32);
  color: var(--text-1);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
}
.hero-chip--chapter { background: rgba(124,92,255,0.18); }
.chip-roman {
  font-family: var(--font-display, inherit);
  font-weight: 800;
  color: #b9a6ff;
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
  background: #1a1a22;
  animation: sk-pulse 1.4s ease-in-out infinite;
}

.char-tile {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #1a1a22;
  border: 1px solid #2a2a38;
  border-radius: 14px;
  padding: 12px 14px;
  cursor: pointer;
  font: inherit;
  text-align: left;
  color: inherit;
  transition: border-color 0.15s, background 0.15s, transform 0.08s;
}
.char-tile:hover:not(:disabled) {
  border-color: rgba(124,92,255,0.55);
  background: #1e1c2c;
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
  background: linear-gradient(135deg, #2a2440, #1a1a22);
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
  background: linear-gradient(135deg, #5c4dbf, #2a2440);
}
.ava-letter { font-size: 22px; font-weight: 700; color: #fff; }

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
  background: rgba(124,92,255,0.22);
  color: #c8b9ff;
  border-radius: 4px;
  padding: 1px 6px;
}
.meta-tpl { font-size: 10px; color: var(--text-muted); }

.tile-arrow {
  flex-shrink: 0;
  font-size: 18px;
  color: rgba(124,92,255,0.6);
  transition: transform 0.15s, color 0.15s;
}
.char-tile:hover:not(:disabled) .tile-arrow { color: var(--accent); transform: translateX(3px); }

.char-tile--create {
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  border-style: dashed;
  border-color: #2e2e42;
  background: transparent;
  min-height: 92px;
}
.char-tile--create:hover:not(:disabled) {
  border-color: var(--accent);
  background: rgba(124,92,255,0.06);
}
.create-icon { font-size: 26px; color: var(--accent); line-height: 1; }
.create-label { font-size: 12px; color: var(--text-muted); font-weight: 600; }

.no-chars {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 28px 16px;
  background: #1a1a22;
  border: 1px dashed #2a2a38;
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

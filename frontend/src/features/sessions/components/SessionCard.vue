<template>
  <div class="s-card" :class="{ 's-card--readonly': isReadonly }" @click="onCardClick">
    <div class="card-top">
      <span class="status-badge" :style="{ '--sc': statusCfg.color }">
        <span class="status-dot" />{{ statusCfg.label }}
      </span>
      <div class="card-top-right">
        <span class="role-label">{{ session.myRole === 'gm' ? 'DM' : 'ИГРОК' }}</span>
        <div class="menu-wrap" @click.stop>
          <button ref="menuBtnEl" class="menu-btn" @click="menuOpen = !menuOpen">⋯</button>
          <BasePopover v-model:open="menuOpen" :anchor="menuBtnEl" placement="bottom-end" :min-width="160">
            <div v-if="session.myRole === 'gm'" class="menu-item menu-danger" @click="menuAction('delete')">
              Удалить
            </div>
            <div v-else class="menu-item menu-warning" @click="menuAction('leave')">
              Выйти из сессии
            </div>
          </BasePopover>
        </div>
      </div>
    </div>

    <div class="card-name">{{ session.name }}</div>
    <div v-if="chapterLabel" class="card-chapter">{{ chapterLabel }}</div>
    <div v-if="session.systemName" class="card-system">{{ session.systemName }}</div>
    <div v-if="session.description" class="card-desc">{{ session.description }}</div>

    <div class="card-bottom">
      <div class="part-row">
        <template v-if="session.myRole === 'player' && myParticipant">
          <span
            class="my-char"
            :class="{ 'my-char--initial': !myParticipant.avaUrl }"
            :style="myAvatarStyle"
          >
            <span v-if="!myParticipant.avaUrl" class="my-char-initial">{{ initialOf(myParticipant) }}</span>
          </span>
          <span class="my-char-label">Мой персонаж</span>
        </template>
        <template v-else-if="participants.length">
          <div class="avatars">
            <span
              v-for="p in participants.slice(0, 4)"
              :key="p.charUuid"
              class="avatar"
              :class="{ 'avatar--initial': !p.avaUrl }"
              :style="avatarStyle(p)"
            >
              <span v-if="!p.avaUrl" class="avatar-initial">{{ initialOf(p) }}</span>
            </span>
          </div>
          <span class="part-count">{{ participants.length }}</span>
        </template>
        <span v-else class="no-players">пока без игроков</span>
      </div>
      <span v-if="relativeDate" class="card-date">{{ relativeDate }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BasePopover } from '@sylvieshare/share-ui'
import { sessionStatusConfig } from '@/features/sessions/composables/useSessionStatus'
import { currentChapterLabel } from '@/features/sessions/lib/chapterGraph'

const AVATAR_COLORS = ['var(--accent)', 'var(--accent)', 'var(--info)', 'var(--danger)', 'var(--success)', 'var(--warning)', 'var(--danger)']

function uuidColor(uuid) {
  if (!uuid) return AVATAR_COLORS[0]
  let h = 0
  for (let i = 0; i < uuid.length; i++) h = (Math.imul(31, h) + uuid.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function initialOf(p) {
  const s = (p?.charUuid || '?').toString()
  return s.charAt(0).toUpperCase()
}

const router = useRouter()

const props = defineProps({
  session: { type: Object, required: true },
})
const emit = defineEmits(['delete', 'leave'])

const menuOpen = ref(false)
const menuBtnEl = ref(null)
const isReadonly = computed(() => false)

function onCardClick() {
  if (props.session.myRole === 'player' && props.session.myCharUuid) {
    router.push({ path: '/char/' + props.session.myCharUuid, query: { session: props.session.uuid } })
    return
  }
  router.push('/sessions/' + props.session.uuid)
}

function menuAction(type) {
  menuOpen.value = false
  if (type === 'delete') emit('delete', props.session)
  else emit('leave', props.session)
}

const statusCfg = computed(() => sessionStatusConfig(props.session.status))
const participants = computed(() => props.session.participants ?? [])

const chapterLabel = computed(() => {
  return currentChapterLabel(props.session.currentChapter)
})

const myParticipant = computed(() => {
  if (props.session.myRole !== 'player' || !props.session.myCharUuid) return null
  return participants.value.find(p => p.charUuid === props.session.myCharUuid) ?? { charUuid: props.session.myCharUuid, avaUrl: null }
})

function avatarStyle(p) {
  if (p.avaUrl) return { backgroundImage: `url(${p.avaUrl})` }
  return { background: uuidColor(p.charUuid) }
}

const myAvatarStyle = computed(() => {
  const p = myParticipant.value
  if (!p) return null
  return avatarStyle(p)
})

const relativeDate = computed(() => {
  const raw = props.session.changedAt
  if (!raw) return ''
  const diff = Date.now() - new Date(raw).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  const w = Math.floor(d / 7)
  const mo = Math.floor(d / 30)
  const y = Math.floor(d / 365)
  if (m < 2)   return 'только что'
  if (m < 60)  return `${m} мин назад`
  if (h < 24)  return `${h} ч назад`
  if (d < 7)   return `${d} дн назад`
  if (w < 5)   return `${w} нед назад`
  if (mo < 12) return `${mo} мес назад`
  return `${y} г назад`
})
</script>

<style scoped>
.s-card {
  background: var(--surface);
  border-radius: var(--r-lg);
  border: 1px solid var(--border);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
  min-height: 140px;
}

.s-card:not(.s-card--readonly):hover {
  border-color: var(--accent-hover);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent);
}

.s-card--readonly { cursor: default; }

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.card-top-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--sc);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sc);
  flex-shrink: 0;
}

.role-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.menu-wrap { position: relative; }

.menu-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  padding: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
}

.s-card:hover .menu-btn,
.menu-btn:focus { opacity: 1; }

.menu-btn:hover { background: var(--surface-raised); color: var(--text-2); }

.menu-item {
  padding: 9px 14px;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  transition: background 0.15s;
}
.menu-item:hover { background: var(--surface-raised); }

.menu-danger { color: var(--danger); }
.menu-danger:hover { background: var(--bg); }

.menu-warning { color: var(--danger); }
.menu-warning:hover { background: var(--bg); }

.card-name {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.3;
}

.card-chapter {
  font-size: 12px;
  color: var(--accent);
  align-self: flex-start;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 18%, transparent);
  border-radius: 6px;
  padding: 2px 8px;
  font-weight: 600;
}

.card-system {
  font-size: 11px;
  color: var(--text-muted);
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  border-radius: 5px;
  padding: 2px 7px;
  align-self: flex-start;
}

.card-desc {
  font-size: 12px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 8px;
}

.part-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.my-char {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  flex-shrink: 0;
  background-size: cover;
  background-position: top center;
  border: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-on-accent);
  font-size: 12px;
  font-weight: 700;
}

.my-char--initial { color: var(--text-on-accent); }
.my-char-initial { font-size: 11px; }

.my-char-label {
  font-size: 11px;
  color: var(--text-2);
}

.avatars { display: flex; }

.avatars .avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--bg);
  margin-left: -6px;
  flex-shrink: 0;
  background-size: cover;
  background-position: top center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-on-accent);
  font-size: 10px;
  font-weight: 700;
}

.avatars .avatar:first-child { margin-left: 0; }

.avatar-initial { font-size: 10px; }

.part-count {
  font-size: 12px;
  color: var(--text-2);
}

.no-players {
  font-size: 12px;
  color: var(--text-muted);
}

.card-date {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}
</style>

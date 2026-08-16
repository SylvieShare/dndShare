<template>
  <article
    class="s-card"
    :class="{ 's-card--readonly': isReadonly }"
    role="link"
    tabindex="0"
    :aria-label="openLabel"
    @click="onCardClick"
    @keydown.enter="onCardClick"
    @keydown.space.prevent="onCardClick"
  >
    <div class="card-cover" :class="{ 'card-cover--empty': !chapterImageUrl }">
      <img
        v-if="chapterImageUrl"
        class="card-cover-image"
        :src="chapterImageUrl"
        :alt="chapterImageAlt"
        :style="chapterImageStyle"
      />
      <div v-else class="card-cover-monogram" aria-hidden="true">{{ sessionInitial }}</div>
      <div class="card-cover-shade" />
      <div class="card-cover-copy">
        <span class="cover-kicker">{{ chapterLabel ? 'Текущая глава' : 'Кампания' }}</span>
        <span v-if="chapterLabel" class="cover-chapter">{{ chapterLabel }}</span>
        <span v-else class="cover-chapter cover-chapter--empty">Глава ещё не выбрана</span>
      </div>
    </div>

    <div class="card-body">
      <div class="card-heading">
        <div class="card-meta">
          <span class="role-label" :class="`role-label--${session.myRole}`">
            {{ session.myRole === 'gm' ? 'Я веду' : 'Я играю' }}
          </span>
          <span v-if="session.myRole === 'player' && session.ownerLogin" class="card-dm">
            Ведёт {{ session.ownerLogin }}
          </span>
          <span v-if="session.systemName" class="card-system">{{ session.systemName }}</span>
          <span v-if="relativeDate" class="card-date">{{ relativeDate }}</span>
        </div>

        <div class="menu-wrap" @click.stop @keydown.stop>
          <button
            ref="menuBtnEl"
            class="menu-btn"
            type="button"
            :aria-label="session.myRole === 'gm' ? 'Действия сессии' : 'Действия участия'"
            @click="menuOpen = !menuOpen"
          >
            ⋯
          </button>
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

      <div class="card-name">{{ session.name }}</div>
      <div v-if="session.description" class="card-desc">{{ session.description }}</div>
      <div v-else class="card-desc card-desc--empty">Без описания</div>

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
                v-for="participant in participants.slice(0, 4)"
                :key="participant.charUuid"
                class="avatar"
                :class="{ 'avatar--initial': !participant.avaUrl }"
                :style="avatarStyle(participant)"
              >
                <span v-if="!participant.avaUrl" class="avatar-initial">{{ initialOf(participant) }}</span>
              </span>
            </div>
            <span class="part-count">{{ participantLabel }}</span>
          </template>
          <span v-else class="no-players">Пока без игроков</span>
        </div>
        <span class="card-open">{{ openActionLabel }} →</span>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BasePopover } from '@sylvieshare/share-ui'
import { currentChapterLabel } from '@/features/sessions/lib/chapterGraph'

const AVATAR_COLORS = ['var(--accent)', 'var(--accent)', 'var(--info)', 'var(--danger)', 'var(--success)', 'var(--warning)', 'var(--danger)']

function uuidColor(uuid) {
  if (!uuid) return AVATAR_COLORS[0]
  let hash = 0
  for (let index = 0; index < uuid.length; index++) hash = (Math.imul(31, hash) + uuid.charCodeAt(index)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function initialOf(participant) {
  const value = (participant?.charUuid || '?').toString()
  return value.charAt(0).toUpperCase()
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

const participants = computed(() => props.session.participants ?? [])
const chapterLabel = computed(() => currentChapterLabel(props.session.currentChapter))
const chapterImageUrl = computed(() => props.session.currentChapter?.imageUrl ?? '')
const chapterImageAlt = computed(() => chapterLabel.value ? `Иллюстрация: ${chapterLabel.value}` : '')
const chapterImageStyle = computed(() => ({
  objectPosition: `${(props.session.currentChapter?.imageFocalX ?? 0.5) * 100}% ${(props.session.currentChapter?.imageFocalY ?? 0.5) * 100}%`,
}))
const sessionInitial = computed(() => props.session.name?.trim().charAt(0).toUpperCase() || 'D')
const openActionLabel = computed(() => props.session.myRole === 'player' && props.session.myCharUuid ? 'К персонажу' : 'Открыть сессию')
const openLabel = computed(() => `${openActionLabel.value} «${props.session.name}»`)

const participantLabel = computed(() => {
  const count = participants.value.length
  const tail = count % 100
  const word = tail >= 11 && tail <= 14
    ? 'игроков'
    : count % 10 === 1 ? 'игрок' : count % 10 >= 2 && count % 10 <= 4 ? 'игрока' : 'игроков'
  return `${count} ${word}`
})

const myParticipant = computed(() => {
  if (props.session.myRole !== 'player' || !props.session.myCharUuid) return null
  return participants.value.find(participant => participant.charUuid === props.session.myCharUuid)
    ?? { charUuid: props.session.myCharUuid, avaUrl: null }
})

function avatarStyle(participant) {
  if (participant.avaUrl) return { backgroundImage: `url(${participant.avaUrl})` }
  return { background: uuidColor(participant.charUuid) }
}

const myAvatarStyle = computed(() => {
  const participant = myParticipant.value
  if (!participant) return null
  return avatarStyle(participant)
})

const relativeDate = computed(() => {
  const raw = props.session.changedAt
  if (!raw) return ''
  const diff = Date.now() - new Date(raw).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)
  if (minutes < 2) return 'только что'
  if (minutes < 60) return `${minutes} мин назад`
  if (hours < 24) return `${hours} ч назад`
  if (days < 7) return `${days} дн назад`
  if (weeks < 5) return `${weeks} нед назад`
  if (months < 12) return `${months} мес назад`
  return `${years} г назад`
})
</script>

<style scoped>
.s-card {
  background: var(--surface);
  border-radius: var(--r-lg);
  border: 1px solid var(--border);
  display: grid;
  grid-template-columns: minmax(220px, 30%) 1fr;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
  box-sizing: border-box;
  min-height: 188px;
}

.s-card:not(.s-card--readonly):hover {
  border-color: var(--accent-hover);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent);
  transform: translateY(-1px);
}

.s-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.s-card--readonly { cursor: default; }

.card-cover {
  position: relative;
  min-height: 186px;
  overflow: hidden;
  background: var(--surface-raised);
}

.card-cover--empty {
  background:
    radial-gradient(circle at 24% 18%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 42%),
    linear-gradient(145deg, var(--surface-active), var(--bg));
}

.card-cover-image {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0;
  object-fit: cover;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.s-card:hover .card-cover-image { transform: scale(1.035); }

.card-cover-monogram {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: color-mix(in srgb, var(--text-1) 12%, transparent);
  font-family: var(--font-display);
  font-size: 112px;
  font-weight: 700;
  line-height: 1;
  transform: translateY(-8px);
}

.card-cover-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 26%, color-mix(in srgb, var(--bg) 92%, transparent));
}

.card-cover-copy {
  position: absolute;
  z-index: 1;
  left: 16px;
  right: 16px;
  bottom: 15px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cover-kicker {
  color: var(--accent-soft);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cover-chapter {
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.cover-chapter--empty {
  color: var(--text-2);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 400;
}

.card-body {
  min-width: 0;
  padding: 18px 20px 16px;
  display: flex;
  flex-direction: column;
}

.card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.card-meta {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.role-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--accent-soft);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 26%, transparent);
  border-radius: var(--r-pill);
  padding: 3px 8px;
  text-transform: uppercase;
}

.role-label--player {
  color: var(--info);
  background: color-mix(in srgb, var(--info) 10%, transparent);
  border-color: color-mix(in srgb, var(--info) 24%, transparent);
}

.card-dm {
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
}

.menu-wrap { position: relative; }

.menu-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--r-sm);
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;
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
.menu-danger,
.menu-warning { color: var(--danger); }
.menu-danger:hover,
.menu-warning:hover { background: var(--bg); }

.card-name {
  font-family: var(--font-display);
  font-size: 23px;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.2;
  margin-top: 12px;
}

.card-system {
  font-size: 11px;
  color: var(--text-muted);
  padding-left: 7px;
  border-left: 1px solid var(--border-strong);
}

.card-desc {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
  margin-top: 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-desc--empty { color: var(--text-muted); }

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: auto;
  padding-top: 14px;
}

.part-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
}

.my-char {
  width: 28px;
  height: 28px;
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
  font-size: 12px;
  color: var(--text-2);
}

.avatars { display: flex; }

.avatars .avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid var(--surface);
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

.part-count,
.no-players {
  font-size: 12px;
  color: var(--text-2);
}

.no-players { color: var(--text-muted); }

.card-date {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.card-open {
  color: var(--accent-soft);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  transition: color 0.15s, transform 0.15s;
}

.s-card:hover .card-open {
  color: var(--text-1);
  transform: translateX(2px);
}

@media (max-width: 760px) {
  .s-card { grid-template-columns: 1fr; }
  .card-cover { min-height: 138px; }
  .card-cover-monogram { font-size: 88px; }
  .card-body { padding: 15px 16px 14px; }
  .card-name { font-size: 20px; margin-top: 10px; }
}

@media (max-width: 430px) {
  .card-cover { min-height: 124px; }
  .card-cover-copy { left: 14px; right: 14px; bottom: 12px; }
  .card-bottom { align-items: flex-end; }
  .part-count { font-size: 11px; }
  .card-open { font-size: 11px; }
}
</style>

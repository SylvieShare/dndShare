<template>
  <main class="player-session">
    <div
      v-if="chapterImage"
      class="player-session__backdrop"
      :style="{ backgroundImage: `url(${chapterImage})` }"
      aria-hidden="true"
    />

    <div class="player-session__content">
      <header class="player-session__intro">
        <div class="player-session__eyebrow">
          <span class="player-session__live-dot" :class="`player-session__live-dot--${liveStatus}`" />
          {{ liveLabel }}
        </div>
        <h1>{{ session.name }}</h1>
        <p v-if="session.description">{{ session.description }}</p>
        <div class="player-session__meta">
          <span v-if="session.systemName">{{ session.systemName }}</span>
          <span>{{ participantCountLabel }}</span>
        </div>
      </header>

      <div class="player-session__grid">
        <BaseTile class="current-chapter" color="var(--accent)" framed>
          <div class="current-chapter__art" :class="{ 'current-chapter__art--empty': !chapterImage }">
            <img
              v-if="chapterImage"
              :src="chapterImage"
              :alt="chapterImageAlt"
              :style="chapterImageStyle"
            />
            <div v-else class="current-chapter__monogram" aria-hidden="true">
              {{ sessionInitial }}
            </div>
            <div class="current-chapter__shade" />

            <div class="current-chapter__topline">
              <span class="current-chapter__kicker"><BookOpen :size="14" /> Текущая глава</span>
              <span v-if="currentChapter?.arcName" class="current-chapter__arc">
                {{ arcTitle }}
              </span>
            </div>

            <div class="current-chapter__copy">
              <template v-if="currentChapter">
                <span class="current-chapter__number">Глава {{ currentChapter.number }}</span>
                <h2>{{ currentChapter.name }}</h2>
                <span class="current-chapter__hint">Здесь сейчас продолжается история</span>
              </template>
              <template v-else>
                <span class="current-chapter__number">Кампания</span>
                <h2>Глава ещё не выбрана</h2>
                <span class="current-chapter__hint">Мастер скоро обозначит следующую часть приключения</span>
              </template>
            </div>
          </div>
        </BaseTile>

        <BaseTile class="party-card" color="var(--info)" framed>
          <div class="party-card__header">
            <div>
              <span class="party-card__kicker">Участники сессии</span>
              <h2><UsersRound :size="21" /> Группа</h2>
            </div>
            <span class="party-card__count">{{ participants.length }}</span>
          </div>

          <div v-if="participants.length" class="party-list">
            <article
              v-for="participant in participants"
              :key="participant.charUuid"
              class="party-member"
              :class="{ 'party-member--mine': isMine(participant) }"
              :style="participantStyle(participant)"
            >
              <div class="party-member__avatar" :class="{ 'party-member__avatar--image': participantAvatar(participant) }">
                <img v-if="participantAvatar(participant)" :src="participantAvatar(participant)" alt="" />
                <span v-else>{{ participantInitial(participant) }}</span>
              </div>

              <div class="party-member__copy">
                <strong>{{ participantName(participant) }}</strong>
                <span v-if="participantSubtitle(participant)">{{ participantSubtitle(participant) }}</span>
                <span v-else-if="isMine(participant)">Ваш персонаж</span>
              </div>

              <RouterLink
                v-if="canOpen(participant)"
                class="party-member__link"
                :to="participantRoute(participant)"
                :aria-label="`${isMine(participant) ? 'Открыть свой лист' : 'Открыть публичный лист'}: ${participantName(participant)}`"
                :title="isMine(participant) ? 'Открыть свой лист' : 'Открыть публичный лист'"
              >
                <span>{{ isMine(participant) ? 'Мой лист' : 'Лист' }}</span>
                <ExternalLink :size="14" />
              </RouterLink>
            </article>
          </div>

          <div v-else class="party-card__empty">
            <UsersRound :size="24" />
            <span>Другие игроки пока не присоединились</span>
          </div>

          <p class="party-card__note">
            Публичные листы можно открыть прямо из состава группы.
          </p>
        </BaseTile>
      </div>
    </div>
  </main>
</template>

<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { BookOpen, ExternalLink, UsersRound } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import { pvAvatar, pvName, pvSubtitle } from '@/features/sessions/lib/participantView'
import { romanNumeral } from '@/features/sessions/lib/chapterGraph'

const props = defineProps({
  session: { type: Object, required: true },
  participants: { type: Array, default: () => [] },
  currentChapter: { type: Object, default: null },
  myCharUuid: { type: String, default: '' },
  liveStatus: { type: String, default: 'idle' },
})

const AVATAR_COLORS = ['var(--accent)', 'var(--info)', 'var(--success)', 'var(--warning)', 'var(--danger)']

const chapterImage = computed(() => props.currentChapter?.imageUrl || '')
const chapterImageAlt = computed(() => props.currentChapter
  ? `Иллюстрация к главе «${props.currentChapter.name}»`
  : '')
const chapterImageStyle = computed(() => ({
  objectPosition: `${(props.currentChapter?.imageFocalX ?? 0.5) * 100}% ${(props.currentChapter?.imageFocalY ?? 0.5) * 100}%`,
}))
const sessionInitial = computed(() => props.session.name?.trim().charAt(0).toUpperCase() || 'D')
const arcTitle = computed(() => {
  if (!props.currentChapter) return ''
  const order = props.currentChapter.arcOrder ? `Арка ${romanNumeral(props.currentChapter.arcOrder)}` : 'Арка'
  return [order, props.currentChapter.arcName].filter(Boolean).join(' · ')
})
const liveLabel = computed(() => props.liveStatus === 'connected'
  ? 'Сессия синхронизирована'
  : props.liveStatus === 'error' ? 'Восстанавливаем связь' : 'Вы в приключении')
const participantCountLabel = computed(() => {
  const count = props.participants.length
  const tail = count % 100
  const word = tail >= 11 && tail <= 14
    ? 'игроков'
    : count % 10 === 1 ? 'игрок' : count % 10 >= 2 && count % 10 <= 4 ? 'игрока' : 'игроков'
  return `${count} ${word}`
})

function participantName(participant) {
  return pvName(participant) || '(без имени)'
}

function participantAvatar(participant) {
  return pvAvatar(participant)
}

function participantSubtitle(participant) {
  return pvSubtitle(participant)
}

function participantInitial(participant) {
  return participantName(participant).charAt(0).toUpperCase()
}

function isMine(participant) {
  return Boolean(props.myCharUuid && participant.charUuid === props.myCharUuid)
}

function canOpen(participant) {
  return isMine(participant) || participant.publicVisible === true
}

function participantRoute(participant) {
  return {
    path: `/char/${participant.charUuid}`,
    query: isMine(participant) ? { session: props.session.uuid } : undefined,
  }
}

function participantStyle(participant) {
  if (participant.color) return { '--party-color': participant.color }
  const key = participant.charUuid || participantName(participant)
  let hash = 0
  for (let index = 0; index < key.length; index += 1) hash = (Math.imul(31, hash) + key.charCodeAt(index)) | 0
  return { '--party-color': AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] }
}
</script>

<style scoped src="./styles/SessionPlayerView.css"></style>
<style scoped src="./styles/SessionPlayerViewResponsive.css"></style>

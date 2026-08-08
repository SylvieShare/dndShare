<template>
  <div class="hero">
    <div class="hero-top">
      <div class="hero-badges">
        <span class="badge-status" :style="{ '--sc': statusCfg.color }">● {{ statusCfg.label }}</span>
        <span v-if="session.systemName" class="badge-system">{{ session.systemName }}</span>
        <span v-if="chapterLabel" class="badge-chapter">{{ chapterLabel }}</span>
      </div>
    </div>

    <div class="hero-title">{{ session.name }}</div>
    <div v-if="session.description" class="hero-subtitle">{{ session.description }}</div>

    <div class="hero-bottom">
      <div class="hero-row">
        <div v-if="participants.length" class="avatars">
          <span
            v-for="p in participants"
            :key="p.charUuid"
            class="avatar"
            :style="avatarStyle(p)"
          />
        </div>
        <span class="hero-count">{{ participants.length }} {{ participantLabel }}</span>
      </div>
      <button
        v-if="canEnter"
        class="btn-enter"
        @click="router.push('/sessions/' + session.uuid)"
      >Войти в сессию →</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const AVATAR_COLORS = ['#7c5ce2', '#c85ce8', '#5cb0e8', '#e85c8a', '#5ce884', '#e89c3c', '#ff6b6b']

const STATUS_CFG = {
  live:      { label: 'Идёт игра',    color: '#e85c5c' },
  active:    { label: 'Активна',      color: '#5ce87c' },
  planned:   { label: 'Запланована',  color: '#5c95e8' },
  paused:    { label: 'Пауза',        color: '#e89c3c' },
  completed: { label: 'Завершено',    color: '#707080' },
  draft:     { label: 'Черновик',     color: 'var(--text-muted)' },
  archived:  { label: 'Архив',        color: 'var(--text-muted)' },
}

function uuidColor(uuid) {
  if (!uuid) return AVATAR_COLORS[0]
  let h = 0
  for (let i = 0; i < uuid.length; i++) h = (Math.imul(31, h) + uuid.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

const router = useRouter()

const props = defineProps({
  session: { type: Object, required: true },
})

const statusCfg = computed(() =>
  STATUS_CFG[props.session.status] ?? { label: props.session.status ?? '', color: 'var(--text-muted)' }
)

const participants = computed(() => props.session.participants ?? [])
const canEnter = computed(() => props.session.myRole === 'gm')

const chapterLabel = computed(() => {
  const ch = props.session.currentChapter
  if (!ch) return ''
  return ch.name ? `Глава ${ch.number}: ${ch.name}` : `Глава ${ch.number}`
})

function avatarStyle(p) {
  if (p?.avaUrl) return { backgroundImage: `url(${p.avaUrl})`, backgroundSize: 'cover', backgroundPosition: 'top center' }
  return { background: uuidColor(p?.charUuid) }
}

const participantLabel = computed(() => {
  const n = participants.value.length
  if (n === 1) return 'игрок'
  if (n >= 2 && n <= 4) return 'игрока'
  return 'игроков'
})
</script>

<style scoped>
.hero {
  background: linear-gradient(135deg, #2c1a28 0%, #1c1020 60%, #1a1018 100%);
  border-radius: 16px;
  padding: 28px 32px 24px;
  border: 1px solid #3a2035;
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.hero-badges {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-status {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--sc);
  background: color-mix(in srgb, var(--sc) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--sc) 35%, transparent);
  border-radius: 6px;
  padding: 3px 8px;
}

.badge-system {
  font-size: 11px;
  color: #8888aa;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 3px 8px;
}

.badge-chapter {
  font-size: 11px;
  color: #c8a8e8;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
  border-radius: 6px;
  padding: 2px 8px;
}

.hero-role {
  font-size: 12px;
  color: #8888aa;
  display: flex;
  align-items: center;
  gap: 7px;
}

.role-pill {
  background: #fff;
  color: #111;
  font-size: 11px;
  font-weight: 700;
  border-radius: 6px;
  padding: 3px 9px;
}

.hero-title {
  font-family: var(--font-display);
  font-size: 40px;
  font-weight: 600;
  color: #fff;
  line-height: 1.1;
  margin-bottom: 6px;
}

.hero-subtitle {
  font-size: 13px;
  color: #9070a0;
  margin-bottom: 24px;
}

.hero-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.hero-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.avatars {
  display: flex;
}

.avatars .avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #1c1020;
  margin-left: -6px;
  flex-shrink: 0;
}

.avatars .avatar:first-child {
  margin-left: 0;
}

.hero-count {
  font-size: 13px;
  color: #b0a0c0;
}

.btn-enter {
  flex-shrink: 0;
  height: 42px;
  padding: 0 22px;
  background: #fff;
  color: #111;
  border: none;
  border-radius: 10px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, transform 0.1s;
}

.btn-enter:hover {
  background: var(--text-1);
  transform: translateY(-1px);
}

@media (max-width: 640px) {
  .hero {
    padding: 20px 18px 18px;
  }

  .hero-title {
    font-size: 24px;
  }

  .hero-bottom {
    flex-direction: column;
    align-items: flex-start;
  }

  .btn-enter {
    width: 100%;
  }
}
</style>

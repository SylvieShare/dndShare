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
import { sessionStatusConfig } from '@/features/sessions/composables/useSessionStatus'
import { currentChapterLabel } from '@/features/sessions/lib/chapterGraph'

const AVATAR_COLORS = ['var(--accent)', 'var(--accent)', 'var(--info)', 'var(--danger)', 'var(--success)', 'var(--warning)', 'var(--danger)']

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

const statusCfg = computed(() => sessionStatusConfig(props.session.status))

const participants = computed(() => props.session.participants ?? [])
const canEnter = computed(() => props.session.myRole === 'gm')

const chapterLabel = computed(() => {
  return currentChapterLabel(props.session.currentChapter)
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
  background: linear-gradient(135deg, var(--popover-bg) 0%, var(--bg) 60%, var(--bg) 100%);
  border-radius: 16px;
  padding: 28px 32px 24px;
  border: 1px solid var(--surface-raised);
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
  color: var(--text-muted);
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  border-radius: 6px;
  padding: 3px 8px;
}

.badge-chapter {
  font-size: 11px;
  color: var(--accent-soft);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
  border-radius: 6px;
  padding: 2px 8px;
}

.hero-role {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 7px;
}

.role-pill {
  background: var(--text-on-accent);
  color: var(--bg);
  font-size: 11px;
  font-weight: 700;
  border-radius: 6px;
  padding: 3px 9px;
}

.hero-title {
  font-family: var(--font-display);
  font-size: 40px;
  font-weight: 600;
  color: var(--text-on-accent);
  line-height: 1.1;
  margin-bottom: 6px;
}

.hero-subtitle {
  font-size: 13px;
  color: var(--text-muted);
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
  border: 2px solid var(--bg);
  margin-left: -6px;
  flex-shrink: 0;
}

.avatars .avatar:first-child {
  margin-left: 0;
}

.hero-count {
  font-size: 13px;
  color: var(--text-2);
}

.btn-enter {
  flex-shrink: 0;
  height: 42px;
  padding: 0 22px;
  background: var(--text-on-accent);
  color: var(--bg);
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

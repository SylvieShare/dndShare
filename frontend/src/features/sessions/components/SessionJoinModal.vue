<template>
  <AppModal :wide="true" @close="$emit('close')">
    <h2 class="modal-title">Войти в сессию</h2>
    <p class="modal-sub">{{ sessionName }}</p>

    <div v-if="loadingChars" class="chars-loading">
      <div v-for="n in 3" :key="n" class="char-skeleton" />
    </div>

    <div v-else-if="chars.length" class="chars-grid">
      <div
        v-for="char in chars"
        :key="char.uuid"
        class="char-tile"
        :class="{ joining: joiningId === char.id }"
        @click="selectChar(char)"
      >
        <div class="tile-ava">
          <img v-if="avaUrl(char)" :src="avaUrl(char)" class="ava-img" alt="" />
          <div v-else class="ava-placeholder" />
        </div>
        <div class="tile-info">
          <div class="tile-name">{{ displayName(char) }}</div>
          <div v-if="who(char)" class="tile-who">{{ who(char) }}</div>
          <div class="tile-meta">
            <span v-if="lvl(char)" class="meta-lvl">Ур.&nbsp;{{ lvl(char) }}</span>
            <span v-if="templateName(char.templateId)" class="meta-tpl">{{ templateName(char.templateId) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="no-chars">Нет доступных персонажей</div>
  </AppModal>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppModal from '@/shared/ui/AppModal'
import { fetchGet } from '@/shared/api/http'
import { joinSession } from '@/shared/api/sessionsApi'
import { pvAvatar, pvLevel, pvName, pvSubtitle } from '@/features/sessions/lib/participantView'
import { useTemplateStore } from '@/stores/template'

const props = defineProps({
  sessionUuid: { type: String, required: true },
  sessionName: { type: String, default: '' },
})
defineEmits(['close'])

const router = useRouter()
const templateStore = useTemplateStore()
const chars = ref([])
const loadingChars = ref(true)
const joiningId = ref(null)

function templateName(templateId) {
  return templateStore.all.find(t => t.id === templateId)?.name ?? ''
}

function displayName(char) {
  return pvName(char) || '(без имени)'
}

function avaUrl(char) {
  return pvAvatar(char)
}

function who(char) {
  return pvSubtitle(char)
}

function lvl(char) {
  return pvLevel(char)
}

async function selectChar(char) {
  if (joiningId.value) return
  joiningId.value = char.id
  try {
    await joinSession(props.sessionUuid, char.id)
    router.push('/char/' + char.uuid)
  } finally {
    joiningId.value = null
  }
}

onMounted(async () => {
  try {
    const [res] = await Promise.all([fetchGet('/chars'), templateStore.ensure()])
    chars.value = res?.chars ?? []
  } finally {
    loadingChars.value = false
  }
})
</script>

<style scoped>
.modal-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-1);
  margin: 0 0 2px;
}

.modal-sub {
  font-size: 13px;
  color: var(--text-2);
  margin: 0 0 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chars-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.char-tile {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-deep);
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
}

.char-tile:hover {
  border-color: var(--accent-dim);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 18%, transparent);
}

.char-tile.joining {
  opacity: 0.5;
  pointer-events: none;
}

.tile-ava {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 8px;
  overflow: hidden;
}

.ava-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
}

.ava-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--accent-dim), var(--accent));
}

.tile-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.tile-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--warning);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile-who {
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.meta-lvl {
  font-size: 11px;
  font-weight: 600;
  background: color-mix(in srgb, var(--accent) 25%, var(--bg-deep));
  color: var(--color-attack);
  border-radius: 5px;
  padding: 1px 6px;
}

.meta-tpl {
  font-size: 11px;
  color: var(--text-muted);
}

.chars-loading {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.char-skeleton {
  height: 74px;
  border-radius: 12px;
  background: var(--bg-deep);
  animation: sk-pulse 1.4s ease-in-out infinite;
}

.no-chars {
  font-size: 14px;
  color: var(--text-muted);
  text-align: center;
  padding: 32px 0;
}

@keyframes sk-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>

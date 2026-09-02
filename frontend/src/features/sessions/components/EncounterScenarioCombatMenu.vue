<template>
  <button
    ref="anchorEl"
    type="button"
    class="enc-icon-btn enc-scenario-combats-trigger"
    :aria-expanded="open"
    aria-label="Бои сценария"
    title="Добавить существ из боя сценария"
    @click="open = !open"
  >
    <ListPlus :size="18" />
    <span>Бои сценария</span>
    <span v-if="loaded && combats.length" class="enc-scenario-combats-count">{{ combats.length }}</span>
  </button>

  <BasePopover v-model:open="open" :anchor="anchorEl" placement="bottom-start" :min-width="320">
    <div class="scenario-combats">
      <div class="scenario-combats-heading">
        <div>
          <strong>Бои сценария</strong>
          <span>{{ scene.name }}</span>
        </div>
        <button type="button" :disabled="loading" title="Обновить список" aria-label="Обновить список боёв" @click="loadCombats">
          <RefreshCw :size="15" :class="{ 'scenario-combats-refresh--loading': loading }" />
        </button>
      </div>

      <div v-if="loading && !loaded" class="scenario-combats-state">Загружаем бои…</div>
      <div v-else-if="error" class="scenario-combats-state scenario-combats-state--error" role="alert">{{ error }}</div>
      <div v-else-if="!combats.length" class="scenario-combats-state">В этом сценарии пока нет боевых блоков.</div>
      <div v-else class="scenario-combats-list">
        <button
          v-for="(combat, index) in combats"
          :key="combat.id"
          type="button"
          :disabled="creatureCount(combat) === 0"
          @click="pick(combat)"
        >
          <span class="scenario-combats-icon"><Swords :size="18" /></span>
          <span class="scenario-combats-copy">
            <strong>{{ combat.title || `Бой ${index + 1}` }}</strong>
            <small>{{ creatureCountLabel(combat) }}</small>
          </span>
          <Plus :size="17" />
        </button>
      </div>
    </div>
  </BasePopover>
</template>

<script setup>
import { ref, watch } from 'vue'
import { ListPlus, Plus, RefreshCw, Swords } from '@lucide/vue'
import { BasePopover } from '@sylvieshare/share-ui'
import { getSceneBlockGraph } from '@/shared/api/scenesApi'

const props = defineProps({
  sessionUuid: { type: String, required: true },
  scene: { type: Object, required: true },
})
const emit = defineEmits(['pick'])

const anchorEl = ref(null)
const open = ref(false)
const combats = ref([])
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
let loadToken = 0

watch(open, value => {
  if (value) loadCombats()
})

watch(() => props.scene.id, () => {
  loadToken += 1
  combats.value = []
  loaded.value = false
  error.value = ''
})

async function loadCombats() {
  if (loading.value) return
  const sceneId = props.scene.id
  const token = ++loadToken
  loading.value = true
  error.value = ''
  try {
    const graph = await getSceneBlockGraph(props.sessionUuid, sceneId)
    if (token !== loadToken || String(props.scene.id) !== String(sceneId)) return
    combats.value = (graph?.items || []).filter(block => block?.type === 'combat')
    loaded.value = true
  } catch {
    if (token !== loadToken) return
    error.value = 'Не удалось загрузить бои сценария'
  } finally {
    if (token === loadToken) loading.value = false
  }
}

function creatureCount(combat) {
  const creatures = Array.isArray(combat?.data?.creatures) ? combat.data.creatures : []
  return creatures.reduce((sum, creature) => sum + Math.max(1, Math.floor(Number(creature?.count) || 1)), 0)
}

function creatureCountLabel(combat) {
  const count = creatureCount(combat)
  if (!count) return 'Существа не добавлены'
  return `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'существо' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20) ? 'существа' : 'существ'}`
}

function pick(combat) {
  if (!creatureCount(combat)) return
  emit('pick', combat)
  open.value = false
}
</script>

<style scoped>
.scenario-combats { width: 320px; display: flex; flex-direction: column; gap: 10px; }
.scenario-combats-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.scenario-combats-heading > div { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.scenario-combats-heading strong { color: var(--text-1); font-size: 14px; }
.scenario-combats-heading span { overflow: hidden; color: var(--text-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.scenario-combats-heading button { width: 30px; height: 30px; display: grid; flex: 0 0 30px; place-items: center; padding: 0; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-raised); color: var(--text-2); cursor: pointer; }
.scenario-combats-heading button:hover:not(:disabled) { border-color: var(--border-strong); color: var(--text-1); }
.scenario-combats-heading button:disabled { cursor: wait; opacity: .5; }
.scenario-combats-refresh--loading { animation: scenario-combats-spin .8s linear infinite; }

.scenario-combats-state { padding: 18px 12px; border: 1px dashed var(--border); border-radius: 9px; color: var(--text-muted); font-size: 11px; line-height: 1.45; text-align: center; }
.scenario-combats-state--error { border-color: color-mix(in srgb, var(--danger) 35%, var(--border)); color: var(--danger); }
.scenario-combats-list { display: flex; max-height: 330px; flex-direction: column; gap: 6px; overflow-y: auto; }
.scenario-combats-list > button { width: 100%; min-height: 54px; display: grid; grid-template-columns: 36px minmax(0, 1fr) 20px; align-items: center; gap: 9px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-raised); color: var(--text-2); font: inherit; text-align: left; cursor: pointer; }
.scenario-combats-list > button:hover:not(:disabled) { border-color: color-mix(in srgb, var(--danger) 52%, var(--border)); background: color-mix(in srgb, var(--danger) 8%, var(--surface-raised)); color: var(--danger); }
.scenario-combats-list > button:disabled { cursor: not-allowed; opacity: .45; }
.scenario-combats-icon { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 8px; background: color-mix(in srgb, var(--danger) 11%, var(--surface)); color: var(--danger); }
.scenario-combats-copy { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.scenario-combats-copy strong { overflow: hidden; color: var(--text-1); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.scenario-combats-copy small { color: var(--text-muted); font-size: 10px; }

@keyframes scenario-combats-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .scenario-combats-refresh--loading { animation: none; } }
</style>

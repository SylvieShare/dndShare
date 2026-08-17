<template>
  <div class="combat-actions">
    <div v-if="loading" class="combat-actions-status">Загружаем словарь действий…</div>
    <BaseTile v-else-if="error" class="combat-actions-status" color="var(--warning)" tint>
      Не удалось загрузить действия. Обнови страницу или открой словарь позже.
    </BaseTile>
    <div v-else class="combat-actions-grid">
      <BaseTile v-for="action in actions" :key="action.code" class="combat-action" :color="actionColor(action.code)" tint>
        <span class="combat-action-icon"><component :is="actionIcon(action.code)" aria-hidden="true" /></span>
        <span>
          <strong>{{ action.value }}</strong>
          <small>{{ action.desc }}</small>
        </span>
      </BaseTile>
    </div>
    <RouterLink class="combat-actions-dictionary" :to="{ path: '/handbook/dictionary', query: { type: COMBAT_ACTION_SUGGEST_TYPE_ID } }">
      <Library aria-hidden="true" /> Открыть словарь действий
    </RouterLink>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  Binoculars,
  BookOpen,
  CircleHelp,
  EyeOff,
  Footprints,
  HandHelping,
  Library,
  PackageOpen,
  Shield,
  Sparkles,
  Swords,
} from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import {
  COMBAT_ACTION_SUGGEST_TYPE_ID,
  officialCombatActions,
} from '@/features/handbook/rules/lib/combatActions'
import { useSuggestStore } from '@/stores/suggest'

const suggestStore = useSuggestStore()
const loading = ref(true)
const error = ref(false)
const actions = computed(() => officialCombatActions(suggestStore.items(COMBAT_ACTION_SUGGEST_TYPE_ID)))

const icons = {
  attack: Swords,
  'cast-spell': Sparkles,
  dash: Footprints,
  disengage: Footprints,
  dodge: Shield,
  help: HandHelping,
  hide: EyeOff,
  ready: BookOpen,
  search: Binoculars,
  'use-object': PackageOpen,
  improvise: CircleHelp,
}

function actionIcon(code) { return icons[code] || CircleHelp }
function actionColor(code) {
  if (code === 'attack') return 'var(--danger)'
  if (code === 'cast-spell') return 'var(--accent)'
  if (['dash', 'disengage', 'dodge'].includes(code)) return 'var(--info)'
  return 'var(--side-neutral)'
}

onMounted(async () => {
  try {
    await suggestStore.ensure(COMBAT_ACTION_SUGGEST_TYPE_ID)
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.combat-actions { margin: 24px 0 28px; }
.combat-actions-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.combat-action { display: grid; grid-template-columns: auto 1fr; align-items: start; gap: 10px; padding: 13px; }
.combat-action-icon { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px; color: var(--tile-color); background: color-mix(in srgb, var(--tile-color) 13%, transparent); }
.combat-action-icon :deep(svg) { width: 17px; height: 17px; }
.combat-action strong,
.combat-action small { display: block; }
.combat-action strong { color: var(--text-1); font-size: 12px; }
.combat-action small { margin-top: 4px; color: var(--text-muted); font-size: 9px; line-height: 1.45; }
.combat-actions-status { padding: 18px; color: var(--text-muted); font-size: 12px; text-align: center; }
.combat-actions-dictionary { width: fit-content; display: flex; align-items: center; gap: 6px; margin: 12px 0 0 auto; color: var(--text-muted); font-size: 10px; text-decoration: none; }
.combat-actions-dictionary:hover { color: var(--accent-soft); }
.combat-actions-dictionary svg { width: 14px; height: 14px; }
@media (max-width: 620px) {
  .combat-actions-grid { grid-template-columns: 1fr; }
}
</style>

<template>
  <EditorSection title="Хиты">
    <div class="sre-row">
      <span class="sre-label">Текущие</span>
      <strong class="sre-hp">{{ current }} / {{ max }}</strong>
    </div>
  </EditorSection>

  <EditorSection title="Кости хитов">
    <div v-for="pool in hitDice" :key="pool.die" class="sre-pool">
      <span class="sre-dice">
        <span class="sre-dice-val">{{ pool.total - pool.used }} / {{ pool.total }} {{ pool.die }}</span>
        <span class="sre-dice-meta">ТЕЛ {{ conLabel }}</span>
      </span>
      <button
        class="sre-btn sre-spend"
        type="button"
        :disabled="!canSpend(pool)"
        @click="$emit('spend', pool.die)"
      >
        Потратить {{ pool.die }}
      </button>
    </div>
  </EditorSection>

  <button class="sre-btn sre-finish" type="button" @click="$emit('finish')">
    Завершить отдых
  </button>
  <p class="sre-note">Восстановит ресурсы с пометкой «короткий отдых».</p>
</template>

<script setup>
import { computed } from 'vue'
import EditorSection from '@/features/character-editor/components/EditorSection'
import { normalizeHitDice } from '@/features/character-editor/blocks/dnd/lib/hitDice'

const props = defineProps({
  hp: { type: Object, required: true },
  conMod: { type: Number, default: 0 },
})
defineEmits(['spend', 'finish'])

const current = computed(() => Number(props.hp.current) || 0)
const max = computed(() => Number(props.hp.max) || 0)
const hitDice = computed(() => normalizeHitDice(props.hp))
const conLabel = computed(() => (props.conMod >= 0 ? '+' : '') + props.conMod)
function canSpend(pool) { return pool.used < pool.total && current.value < max.value }
</script>

<style scoped>
.sre-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.sre-pool { display: grid; grid-template-columns: 1fr minmax(130px, auto); align-items: center; gap: 10px; }
.sre-pool + .sre-pool { padding-top: 8px; border-top: 1px solid var(--border); }
.sre-label { color: var(--text-muted); font-size: 13px; }
.sre-hp { color: var(--text-1); font-size: 15px; font-weight: 700; }
.sre-dice { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; }
.sre-dice-val { color: var(--text-1); font-size: 15px; font-weight: 700; }
.sre-dice-meta { color: var(--text-muted); font-size: 11px; }

.sre-btn {
  border: none;
  border-radius: 8px;
  padding: 12px 8px;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  touch-action: manipulation;
  transition: opacity 0.12s, background 0.12s;
}
.sre-spend { background: color-mix(in srgb, var(--success) 22%, transparent); color: var(--success); }
.sre-spend:hover:not(:disabled) { opacity: 0.85; }
.sre-spend:disabled { opacity: 0.3; cursor: not-allowed; }
.sre-finish { background: color-mix(in srgb, var(--warning) 22%, transparent); color: var(--text-2); }
.sre-finish:hover { opacity: 0.85; }
.sre-note { margin: 0; color: var(--text-muted); font-size: 11px; text-align: center; }
</style>

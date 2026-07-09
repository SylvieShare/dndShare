<template>
  <div class="sre-title">Короткий отдых</div>

  <EditorSection title="Хиты">
    <div class="sre-row">
      <span class="sre-label">Текущие</span>
      <strong class="sre-hp">{{ current }} / {{ max }}</strong>
    </div>
  </EditorSection>

  <EditorSection title="Кости хитов">
    <div class="sre-row">
      <span class="sre-label">Осталось</span>
      <span class="sre-dice">
        <span class="sre-dice-val">{{ remaining }} / {{ count }}</span>
        <span class="sre-dice-meta">{{ dieLabel }} · ТЕЛ {{ conLabel }}</span>
      </span>
    </div>
    <button
      class="sre-btn sre-spend"
      type="button"
      :disabled="!canSpend"
      @click="$emit('spend')"
    >
      Потратить кость хитов
    </button>
  </EditorSection>

  <button class="sre-btn sre-finish" type="button" @click="$emit('finish')">
    Завершить отдых
  </button>
  <p class="sre-note">Восстановит ресурсы с пометкой «короткий отдых».</p>
</template>

<script setup>
import { computed } from 'vue'
import EditorSection from '@/features/character-editor/components/EditorSection'

const props = defineProps({
  hp: { type: Object, required: true },
  dieLabel: { type: String, default: 'd8' },
  conMod: { type: Number, default: 0 },
})
defineEmits(['spend', 'finish'])

const current = computed(() => Number(props.hp.current) || 0)
const max = computed(() => Number(props.hp.max) || 0)
const count = computed(() => Number(props.hp.diceCount) || 1)
const used = computed(() => Math.max(0, Math.min(count.value, Number(props.hp.diceUsed) || 0)))
const remaining = computed(() => count.value - used.value)
const conLabel = computed(() => (props.conMod >= 0 ? '+' : '') + props.conMod)
const canSpend = computed(() => remaining.value > 0 && current.value < max.value)
</script>

<style scoped>
.sre-title { color: var(--text-1); font-size: 16px; font-weight: 700; }
.sre-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.sre-label { color: var(--text-muted); font-size: 13px; }
.sre-hp { color: var(--text-1); font-size: 15px; font-weight: 700; }
.sre-dice { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
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
.sre-spend { background: rgba(60, 175, 110, 0.22); color: #5aaf72; }
.sre-spend:hover:not(:disabled) { opacity: 0.85; }
.sre-spend:disabled { opacity: 0.3; cursor: not-allowed; }
.sre-finish { background: rgba(202, 154, 74, 0.22); color: #d8bd86; }
.sre-finish:hover { opacity: 0.85; }
.sre-note { margin: 0; color: var(--text-muted); font-size: 11px; text-align: center; }
</style>

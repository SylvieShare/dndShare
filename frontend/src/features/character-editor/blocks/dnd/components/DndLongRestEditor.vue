<template>
  <EditorSection title="Восстановление">
    <p class="lre-copy">
      Хиты и ячейки заклинаний восстановятся полностью, ресурсы отдыха перезарядятся,
      истощение снизится на 1.
    </p>
  </EditorSection>

  <EditorSection title="Кости хитов">
    <p v-if="recoveryCount === 0" class="lre-copy">Все кости уже доступны.</p>
    <template v-else>
      <div class="lre-summary">
        Выбрано <strong>{{ selectedCount }} / {{ recoveryCount }}</strong>
      </div>
      <div v-for="pool in spentPools" :key="pool.die" class="lre-pool">
        <span class="lre-pool-label">
          <strong>{{ pool.die }}</strong>
          <small>потрачено {{ pool.used }}</small>
        </span>
        <div class="lre-controls">
          <button type="button" :disabled="selected(pool.die) <= 0" @click="adjust(pool, -1)">−</button>
          <strong>{{ selected(pool.die) }}</strong>
          <button
            type="button"
            :disabled="selected(pool.die) >= pool.used || selectedCount >= recoveryCount"
            @click="adjust(pool, 1)"
          >+</button>
        </div>
      </div>
    </template>
  </EditorSection>

  <div class="lre-actions">
    <button class="lre-btn lre-cancel" type="button" @click="$emit('cancel')">Отмена</button>
    <button class="lre-btn lre-confirm" type="button" :disabled="selectedCount !== recoveryCount" @click="confirm">
      Отдохнуть
    </button>
  </div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import EditorSection from '@/features/character-editor/components/EditorSection'
import { normalizeHitDice } from '@/features/character-editor/blocks/dnd/lib/hitDice'

const props = defineProps({
  hp: { type: Object, required: true },
  recoveryCount: { type: Number, required: true },
})
const emit = defineEmits(['confirm', 'cancel'])

const spentPools = computed(() => normalizeHitDice(props.hp).filter((pool) => pool.used > 0))
const allocation = reactive({})
let left = props.recoveryCount
for (const pool of spentPools.value) {
  allocation[pool.die] = Math.min(pool.used, left)
  left -= allocation[pool.die]
}

const selectedCount = computed(() => Object.values(allocation).reduce((sum, value) => sum + (Number(value) || 0), 0))
function selected(die) { return Number(allocation[die]) || 0 }
function adjust(pool, delta) {
  allocation[pool.die] = Math.max(0, Math.min(pool.used, selected(pool.die) + delta))
}
function confirm() {
  if (selectedCount.value !== props.recoveryCount) return
  emit('confirm', { ...allocation })
}
</script>

<style scoped>
.lre-copy { margin: 0; color: var(--text-2); font-size: 13px; line-height: 1.5; }
.lre-summary { color: var(--text-muted); font-size: 12px; }
.lre-summary strong { color: var(--text-1); }
.lre-pool { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.lre-pool + .lre-pool { padding-top: 8px; border-top: 1px solid var(--border); }
.lre-pool-label { display: flex; flex-direction: column; gap: 2px; color: var(--text-1); }
.lre-pool-label small { color: var(--text-muted); font-size: 11px; }
.lre-controls { display: grid; grid-template-columns: 32px 28px 32px; align-items: center; text-align: center; }
.lre-controls button {
  width: 32px; height: 32px; border: none; border-radius: 8px;
  background: var(--surface-raised); color: var(--text-1); font: inherit; font-weight: 700; cursor: pointer;
}
.lre-controls button:disabled { opacity: 0.3; cursor: default; }
.lre-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.lre-btn { border: none; border-radius: 8px; padding: 12px 8px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
.lre-btn:disabled { opacity: 0.35; cursor: default; }
.lre-cancel { background: var(--surface-raised); color: var(--text-2); }
.lre-confirm { background: color-mix(in srgb, var(--warning) 22%, transparent); color: var(--text-1); }
</style>

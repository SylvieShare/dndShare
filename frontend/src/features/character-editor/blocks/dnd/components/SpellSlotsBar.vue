<template>
  <div class="sp-bar" :style="{ '--spell-slot-hit-size': `${slotHitSize}px` }">
    <div v-if="showStats && hasStatConfig" class="sp-stats-panel">
      <SpellcastingParameters v-if="castingStats.length <= 1" :stat-label="statLabel" :save-d-c="saveDC"
        :attack-bonus="attackBonus" :save-formula="saveFormula" :attack-formula="attackFormula"
        :editable="canInteract && showCastingConfig" @settings="openEditor" />
      <div v-else class="sp-caster-stats">
        <div v-for="row in castingStats" :key="row.key" class="sp-caster-row">
          <strong>{{ row.label }}</strong>
          <span>{{ row.ability }}</span>
          <span>СЛ {{ row.saveDC }}</span>
          <span>Атака {{ row.attackBonus >= 0 ? '+' + row.attackBonus : row.attackBonus }}</span>
        </div>
        <ActionButton v-if="canInteract && showCastingConfig" variant="secondary" @click="openEditor">Настройки вкладки</ActionButton>
      </div>
    </div>

    <MorphTile :outlined="false" v-if="showSlots && (activeSlotPools.length > 0 || canInteract)" class="sp-slots-panel" edit-label="Редактировать"
        title="Ячейки заклинаний"
        :show-edit="canInteract"
        @edit="editOpen = true"
      >
      <div class="sp-pools">
        <section v-for="pool in activeSlotPools" :key="pool.rest" class="sp-pool">
          <div v-if="activeSlotPools.length > 1" class="sp-pool-head">
            <span>{{ pool.rest === 'short_rest' ? 'Короткий отдых' : 'Долгий отдых' }}</span>
          </div>
          <div class="sp-slots">
            <div v-for="slot in pool.slots" :key="slot.level" class="sp-slot-row">
              <div class="sp-lvl">
                <span class="sp-lvl-num">{{ slot.level }}</span>
                <span class="sp-lvl-unit">круг</span>
              </div>
              <div class="sp-orbs">
                <template v-if="slot.total <= 100">
                  <ActionButton v-for="i in orbOrder(slot.total)" :key="i" icon-only variant="quiet" class="sp-orb-hit"
                    :disabled="!canInteract" :aria-label="`Ячейка ${slot.level} круга · ${i}`"
                    :aria-pressed="i > slot.used" @click="$emit('toggle-slot', pool.rest, slot.level, i)">
                    <template #icon><SpellSlotSphere :spent="i <= slot.used" :level="slot.level" :size="slotOrbSize" :interactive="canInteract" /></template>
                  </ActionButton>
                </template>
                <template v-else>
                  <span>{{ slot.total - slot.used }} / {{ slot.total }}</span>
                  <ActionButton variant="quiet" :disabled="!canInteract || !slot.used" @click="$emit('toggle-slot', pool.rest, slot.level, slot.used)">Восстановить</ActionButton>
                  <ActionButton variant="quiet" :disabled="!canInteract || slot.used >= slot.total" @click="$emit('toggle-slot', pool.rest, slot.level, slot.used + 1)">Потратить</ActionButton>
                </template>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MorphTile>

    <DndSpellbookSettingsModal
      v-if="editOpen"
      :slot-pools="slotPools"
      :stat-path="statPath"
      :stat-options="statOptions"
      :save-bonus="saveBonusExtra"
      :attack-bonus="attackBonusExtra"
      :show-casting-config="showCastingConfig"
      :casting-label="castingLabel"
      :show-slot-config="showSlotConfig"
      @change="(rest, level, total) => $emit('set-total', rest, level, total)"
      @set-stat-path="$emit('set-stat-path', $event)"
      @set-save-bonus="$emit('set-save-bonus', $event)"
      @set-attack-bonus="$emit('set-attack-bonus', $event)"
      @close="editOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

import DndSpellbookSettingsModal from '@/features/character-editor/blocks/dnd/DndSpellbookSettingsModal.vue'
import SpellSlotSphere from '@/features/items/components/SpellSlotSphere.vue'
import SpellcastingParameters from './SpellcastingParameters.vue'
import { ActionButton, MorphTile, useMediaQuery } from '@sylvieshare/share-ui'
import { designMediaQueries, layoutTokens } from '@/app/design-tokens'

const editOpen = ref(false)
const touchTargets = useMediaQuery(`${designMediaQueries['--ui-compact']}, (pointer: coarse)`)
const slotHitSize = computed(() => layoutTokens[touchTargets.value ? 'spell-slot-touch-hit-size' : 'spell-slot-hit-size'])
const slotOrbSize = computed(() => layoutTokens[touchTargets.value ? 'spell-slot-touch-orb-size' : 'spell-slot-orb-size'])

const props = defineProps({
  hasStatConfig:   { type: Boolean, default: false },
  canInteract:     { type: Boolean, default: false },
  statPath:        { default: '' },
  statOptions:     { type: Array, default: () => [] },
  statLabel:       { type: String, default: '' },
  saveDC:          { type: Number, default: 0 },
  attackBonus:     { type: Number, default: 0 },
  saveBonusExtra:   { type: Number, default: 0 },
  attackBonusExtra: { type: Number, default: 0 },
  activeSlotPools: { type: Array, default: () => [] },
  slotPools:       { type: Object, default: () => ({ long_rest: [], short_rest: [] }) },
  castingStats:    { type: Array, default: () => [] },
  showCastingConfig: { type: Boolean, default: true },
  castingLabel: { type: String, default: '' },
  showStats: { type: Boolean, default: true },
  showSlots: { type: Boolean, default: true },
  showSlotConfig: { type: Boolean, default: true },
  externalEditor: { type: Boolean, default: false },
})
const emit = defineEmits(['set-stat-path', 'set-total', 'set-save-bonus', 'set-attack-bonus', 'toggle-slot', 'edit'])

function openEditor() {
  if (props.externalEditor) emit('edit')
  else editOpen.value = true
}

function orbOrder(total) {
  return Array.from({ length: total }, (_, k) => total - k)
}
const signedPart = value => Number(value) >= 0 ? `+ ${Number(value)}` : `− ${Math.abs(Number(value))}`
const saveFormula = computed(() => `8 + бонус мастерства + модификатор ${props.statLabel || 'базовой характеристики'} ${signedPart(props.saveBonusExtra)} = ${props.saveDC}`)
const attackFormula = computed(() => `Бонус мастерства + модификатор ${props.statLabel || 'базовой характеристики'} ${signedPart(props.attackBonusExtra)} = ${props.attackBonus >= 0 ? '+' : ''}${props.attackBonus}`)
</script>

<style scoped>
.sp-bar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-medium);
  margin-bottom: var(--spacing-medium);
}

.sp-slots-panel { padding:var(--spacing-medium); }


.sp-caster-stats { display: grid; gap: 8px; }
.sp-caster-row { display: grid; grid-template-columns: minmax(90px, 1fr) repeat(3, auto); align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--border); color: var(--text-2); font-size: 12px; }
.sp-caster-row:last-child { border-bottom: 0; }
.sp-caster-row strong { color: var(--text-1); }
.sp-pools { display: grid; gap: var(--spacing-small); }
.sp-pool + .sp-pool { padding-top: var(--spacing-small); border-top: 1px solid var(--border); }
.sp-pool-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 4px; color: var(--text-1); font-size: 12px; font-weight: 750; }

/* ── Ячейки (ряды по кругам) ── */
.sp-slot-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-small);
  padding: calc(var(--spacing-xs) / 2) 0;
  border-top: 1px solid color-mix(in srgb, var(--text-on-accent) 7%, transparent);
}
.sp-slot-row:first-of-type {
  border-top: none;
}

.sp-lvl {
  flex: none;
  width: 32px;
  text-align: right;
  line-height: 1;
}
.sp-lvl-num {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
}
.sp-lvl-unit {
  display: block;
  margin-top: 2px;
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sp-orbs {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  align-items: center;
  min-width: 0;
  min-height: var(--spell-slot-hit-size);
}
.sp-orb-hit { --action-button-icon-size:var(--spell-slot-hit-size); }

.sp-orb-hit:disabled { opacity: 1; }

.sp-orbs-empty {
  color: var(--text-muted);
  font-size: 14px;
}

@media (max-width: 760px) {
  .sp-caster-row {grid-template-columns:1fr auto;gap:5px 10px}
}
</style>

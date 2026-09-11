<template>
  <div v-if="hitPoints || slotChanges.length" class="level-gains">
    <BaseTile v-if="hitPoints" class="level-gains-hp" color="var(--danger)" framed>
      <div class="level-gains-heading"><HeartPulse :size="15" aria-hidden="true" /><span>{{ level === 1 ? 'Хиты на старте' : 'Прирост хитов' }}</span></div>
      <div class="level-gains-formula" role="img" :aria-label="hitPoints">
        <template v-if="sides">
          <div class="level-gains-roll" aria-hidden="true">
            <strong v-if="level === 1" class="level-gains-number">{{ sides }}</strong>
            <SystemDie v-else :sides="sides" :size="36" color="var(--danger)" />
            <span class="level-gains-alternative">{{ level === 1 ? 'макс. кости' : `или ${fixedGain}` }}</span>
          </div>
          <span class="level-gains-plus" aria-hidden="true">+</span>
          <div class="level-gains-stat" aria-hidden="true"><strong>ТЕЛ</strong><span>модификатор</span></div>
        </template>
        <strong v-else>{{ hitPoints }}</strong>
      </div>
    </BaseTile>
    <div v-if="slotChanges.length" class="level-gains-magic">
      <div class="level-gains-heading"><Sparkles :size="15" aria-hidden="true" /><span>Изменения ячеек</span></div>
      <div class="level-gains-slots">
        <div v-for="(slot, index) in slotChanges" :key="index" class="level-gains-slot">
          <div class="level-gains-slot-value" role="img" :aria-label="slot.kind === 'added' ? `Добавляется ${slot.count} яч. ${slot.level} круга` : `${slot.count} яч. усиливаются с ${slot.fromLevel} до ${slot.level} круга`">
            <strong v-if="showSingleCount || slot.kind !== 'added' || slot.count !== 1" class="level-gains-slot-count" aria-hidden="true">{{ slot.kind === 'added' ? '+' : '' }}{{ slot.count }}</strong>
            <div class="level-gains-slot-icon" aria-hidden="true">
              <SpellSlotSphere :level="slot.level" :size="28" :interactive="false" />
              <small>{{ slot.kind === 'upgraded' ? `${slot.fromLevel} → ` : '' }}{{ slot.level }} круг</small>
            </div>
          </div>
          <small v-if="slot.pact" class="level-gains-slot-note">Магия договора<br />Короткий отдых</small>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { HeartPulse, Sparkles } from '@lucide/vue'
import { BaseTile } from '@sylvieshare/share-ui'
import SystemDie from '@/shared/ui/SystemDie.vue'
import SpellSlotSphere from '@/features/items/components/SpellSlotSphere.vue'
import { avgHitDie, dieFaceOf } from '@/features/character-editor/blocks/dnd/lib/levelUp'

const props = defineProps({
  level: { type: Number, required: true },
  hitPoints: { type: String, default: '' },
  hitDie: { type: [String, Number], default: null },
  slotChanges: { type: Array, default: () => [] },
  showSingleCount: { type: Boolean, default: false },
})
const sides = computed(() => dieFaceOf(props.hitDie))
const fixedGain = computed(() => avgHitDie(sides.value))
</script>

<style scoped>
.level-gains { display: flex; flex-wrap: wrap; align-items: stretch; gap: 12px 20px; margin-bottom: 16px; }
.level-gains-hp { flex: 0 1 210px; min-width: 0; padding: 12px 14px; }
.level-gains-heading { display: flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: 10px; font-weight: 650; }
.level-gains-hp .level-gains-heading svg { color: var(--danger); }
.level-gains-formula { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 8px; margin-top: 10px; color: var(--text-1); }
.level-gains-formula > strong { grid-column: 1 / -1; }
.level-gains-roll, .level-gains-stat { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.level-gains-number { min-height: 36px; font: 650 30px/36px var(--font-display); color: var(--danger); }
.level-gains-alternative, .level-gains-stat span { font-size: 10px; color: var(--text-muted); }
.level-gains-plus { color: var(--text-muted); font-size: 20px; }
.level-gains-stat strong { font-size: 15px; letter-spacing: .08em; }
.level-gains-magic { flex: 1 1 150px; min-width: 0; padding: 12px 0; }
.level-gains-magic .level-gains-heading svg { color: var(--accent-soft); }
.level-gains-slots { display: flex; flex-wrap: wrap; gap: 12px 18px; margin-top: 12px; }
.level-gains-slot { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; color: var(--text-2); }
.level-gains-slot-value { display: flex; align-items: flex-start; gap: 8px; }
.level-gains-slot-count { line-height: 28px; font-size: 16px; }
.level-gains-slot-icon { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.level-gains-slot-icon small, .level-gains-slot-note { color: var(--text-muted); font-size: 10px; }
</style>

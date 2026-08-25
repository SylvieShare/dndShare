<template>
  <div class="sp-bar">
    <BaseTile v-if="hasStatConfig" class="sp-stats-panel">
      <SheetBlockTitle
        class="sp-mobile-panel-head"
        :title="castingPanelTitle"
        :show-edit="canInteract && showCastingConfig"
        @edit="editOpen = true"
      />
      <div v-if="castingStats.length <= 1" class="sp-stats">
        <div class="sp-tile sp-tile--base">
          <span class="sp-tlabel">Базовая хар-ка</span>
          <span class="sp-tval sp-tval-stat">{{ statLabel || '—' }}</span>
          <span class="sp-tline"></span>
        </div>
        <div class="sp-tile sp-tile--dc" :title="saveFormula">
          <span class="sp-tlabel">СЛ спасброска</span>
          <span class="sp-tval">{{ saveDC }}</span>
          <span class="sp-tline"></span>
        </div>
        <div class="sp-tile sp-tile--atk" :title="attackFormula">
          <span class="sp-tlabel">Атака закл.</span>
          <span class="sp-tval sp-tval-atk">{{ attackBonus >= 0 ? '+' + attackBonus : attackBonus }}</span>
          <span class="sp-tline"></span>
        </div>
      </div>
      <div v-else class="sp-caster-stats">
        <div v-for="row in castingStats" :key="row.key" class="sp-caster-row">
          <strong>{{ row.label }}</strong>
          <span>{{ row.ability }}</span>
          <span>СЛ {{ row.saveDC }}</span>
          <span>Атака {{ row.attackBonus >= 0 ? '+' + row.attackBonus : row.attackBonus }}</span>
        </div>
      </div>
    </BaseTile>

    <BaseTile v-if="activeSlotPools.length > 0" class="sp-slots-panel">
      <SheetBlockTitle
        class="sp-slots-head"
        title="Ячейки заклинаний"
        :show-edit="canInteract"
        @edit="editOpen = true"
      />
      <div class="sp-pools">
        <section v-for="pool in activeSlotPools" :key="pool.rest" class="sp-pool">
          <div class="sp-pool-head">
            <span>{{ pool.rest === 'short_rest' ? 'Короткий отдых' : 'Долгий отдых' }}</span>
            <small>{{ pool.rest === 'short_rest' ? 'восстанавливаются также после долгого' : 'восстанавливаются после долгого' }}</small>
          </div>
          <div class="sp-slots">
            <div v-for="slot in pool.slots" :key="slot.level" class="sp-slot-row">
              <div class="sp-lvl">
                <span class="sp-lvl-num">{{ slot.level }}</span>
                <span class="sp-lvl-unit">круг</span>
              </div>
              <div class="sp-orbs">
                <SpellSlotSphere
                  v-for="i in orbOrder(slot.total)"
                  :key="i"
                  :spent="i <= slot.used"
                  :level="slot.level"
                  :interactive="canInteract"
                  @click="$emit('toggle-slot', pool.rest, slot.level, i)"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </BaseTile>

    <DndSpellbookSettingsModal
      v-if="editOpen"
      :slot-pools="slotPools"
      :stat-path="statPath"
      :stat-options="statOptions"
      :save-bonus="saveBonusExtra"
      :attack-bonus="attackBonusExtra"
      :preparation="preparation"
      :automatic-slots="automaticSlots"
      :show-casting-config="showCastingConfig"
      :casting-label="castingLabel"
      @change="(rest, level, total) => $emit('set-total', rest, level, total)"
      @set-stat-path="$emit('set-stat-path', $event)"
      @set-save-bonus="$emit('set-save-bonus', $event)"
      @set-attack-bonus="$emit('set-attack-bonus', $event)"
      @set-preparation="$emit('set-preparation', $event)"
      @set-automatic-slots="$emit('set-automatic-slots', $event)"
      @close="editOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

import DndSpellbookSettingsModal from '@/features/character-editor/blocks/dnd/DndSpellbookSettingsModal.vue'
import SpellSlotSphere from '@/features/items/components/SpellSlotSphere.vue'
import { BaseTile } from '@sylvieshare/share-ui'
import SheetBlockTitle from '@/shared/ui/SheetBlockTitle'

const editOpen = ref(false)

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
  preparation:     { type: Boolean, default: false },
  activeSlotPools: { type: Array, default: () => [] },
  slotPools:       { type: Object, default: () => ({ long_rest: [], short_rest: [] }) },
  castingStats:    { type: Array, default: () => [] },
  automaticSlots:  { type: Boolean, default: true },
  showCastingConfig: { type: Boolean, default: true },
  castingLabel: { type: String, default: '' },
})
defineEmits(['set-stat-path', 'set-total', 'set-save-bonus', 'set-attack-bonus', 'set-preparation', 'set-automatic-slots', 'toggle-slot'])

function orbOrder(total) {
  return Array.from({ length: total }, (_, k) => total - k)
}
const signedPart = value => Number(value) >= 0 ? `+ ${Number(value)}` : `− ${Math.abs(Number(value))}`
const saveFormula = computed(() => `8 + бонус мастерства + модификатор ${props.statLabel || 'базовой характеристики'} ${signedPart(props.saveBonusExtra)} = ${props.saveDC}`)
const attackFormula = computed(() => `Бонус мастерства + модификатор ${props.statLabel || 'базовой характеристики'} ${signedPart(props.attackBonusExtra)} = ${props.attackBonus >= 0 ? '+' : ''}${props.attackBonus}`)
const castingPanelTitle = computed(() => props.castingStats.length <= 1 && props.castingLabel
  ? `Параметры магии · ${props.castingLabel}`
  : 'Параметры магии')
</script>

<style scoped>
.sp-bar {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-bottom: 18px;
}

.sp-stats-panel,
.sp-slots-panel {
  padding: 18px;
}

.sp-mobile-panel-head {
  display: flex;
  margin-bottom: 12px;
}

.sp-slots-head { margin-bottom: 12px; }

.sp-caster-stats { display: grid; gap: 8px; }
.sp-caster-row { display: grid; grid-template-columns: minmax(90px, 1fr) repeat(3, auto); align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--border); color: var(--text-2); font-size: 12px; }
.sp-caster-row:last-child { border-bottom: 0; }
.sp-caster-row strong { color: var(--text-1); }
.sp-pools { display: grid; gap: 14px; }
.sp-pool + .sp-pool { padding-top: 14px; border-top: 1px solid var(--border); }
.sp-pool-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 4px; color: var(--text-1); font-size: 12px; font-weight: 750; }
.sp-pool-head small { color: var(--text-muted); font-size: 10px; font-weight: 500; }

/* ── Статы (строка безрамочных плиток сверху) ── */
.sp-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.sp-tile {
  position: relative;
  flex: 1 1 120px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
  overflow: hidden;
  background: var(--bg);
  border: 1.5px solid var(--surface-active);
  border-radius: var(--r-md);
  padding: 12px 13px;
  --c: var(--accent);
}
.sp-tile--dc  { --c: var(--info); }
.sp-tile--atk { --c: var(--accent-soft); }

.sp-tlabel {
  display: block;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1.15;
  text-transform: uppercase;
}

.sp-tval {
  display: block;
  color: var(--text-1);
  font-size: 26px;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.sp-tval-stat {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-1);
}

.sp-tval-atk {
  color: var(--text-1);
}

.sp-tline {
  display: block;
  margin-top: auto;
  height: 3px;
  border-radius: 2px;
  background: var(--c);
  box-shadow: 0 0 9px color-mix(in srgb, var(--c) 70%, transparent);
}

/* ── Ячейки (ряды по кругам) ── */
.sp-slot-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px solid color-mix(in srgb, var(--text-on-accent) 7%, transparent);
}
.sp-slot-row:first-of-type {
  border-top: none;
}

.sp-lvl {
  flex: none;
  width: 40px;
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
  gap: 9px;
  align-items: center;
  min-width: 0;
  min-height: 24px;
}

.sp-orbs-empty {
  color: var(--text-muted);
  font-size: 14px;
}

@media (max-width: 760px) {
  .sp-bar {
    gap: 12px;
    margin-bottom: 12px;
  }

  .sp-stats-panel,
  .sp-slots-panel {
    padding: 14px;
  }

  .sp-stats {
    flex-wrap: nowrap;
    gap: 0;
  }

  .sp-caster-row {
    grid-template-columns: 1fr auto;
    gap: 5px 10px;
  }

  .sp-tile {
    flex-basis: 0;
    gap: 7px;
    padding: 6px 10px 4px;
    border: none;
    border-radius: 0;
    background: transparent;
  }

  .sp-tile + .sp-tile {
    border-left: 1px solid var(--border);
  }

  .sp-tlabel {
    min-height: 21px;
    font-size: 9px;
  }

  .sp-tval { font-size: 23px; }
  .sp-tval-stat { font-size: 16px; }
  .sp-tline { width: 28px; }

  .sp-slot-row {
    padding: 9px 0;
  }
}
</style>

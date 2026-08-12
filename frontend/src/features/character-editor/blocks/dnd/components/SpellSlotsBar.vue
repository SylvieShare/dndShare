<template>
  <div class="sp-bar">
    <section v-if="hasStatConfig" class="sp-stats-panel">
      <SheetBlockTitle
        class="sp-mobile-panel-head"
        title="Параметры магии"
        :show-edit="canInteract"
        divider
        @edit="editOpen = true"
      />
      <div class="sp-stats">
        <div class="sp-tile sp-tile--base">
          <span class="sp-tlabel">Базовая хар-ка</span>
          <span class="sp-tval sp-tval-stat">{{ statLabel || '—' }}</span>
          <span class="sp-tline"></span>
        </div>
        <div class="sp-tile sp-tile--dc">
          <span class="sp-tlabel">СЛ спасброска</span>
          <span class="sp-tval">{{ saveDC }}</span>
          <span class="sp-tline"></span>
        </div>
        <div class="sp-tile sp-tile--atk">
          <span class="sp-tlabel">Атака закл.</span>
          <span class="sp-tval sp-tval-atk">{{ attackBonus >= 0 ? '+' + attackBonus : attackBonus }}</span>
          <span class="sp-tline"></span>
        </div>
      </div>
    </section>

    <section v-if="activeSlots.length > 0" class="sp-slots-panel">
      <SheetBlockTitle
        class="sp-slots-head"
        title="Ячейки заклинаний"
        :show-edit="canInteract"
        divider
        @edit="editOpen = true"
      />
      <div class="sp-slots">
        <div v-for="sl in activeSlots" :key="sl.level" class="sp-slot-row">
          <div class="sp-lvl">
            <span class="sp-lvl-num">{{ sl.level }}</span>
            <span class="sp-lvl-unit">круг</span>
          </div>
          <div class="sp-orbs">
            <SpellSlotSphere
              v-for="i in orbOrder(sl.total)"
              :key="i"
              :spent="i <= sl.used"
              :level="sl.level"
              :interactive="canInteract"
              @click="$emit('toggle-slot', sl.level, i)"
            />
            <span v-if="sl.total === 0" class="sp-orbs-empty">—</span>
          </div>
        </div>
      </div>
    </section>

    <DndSpellbookSettingsModal
      v-if="editOpen"
      :slots="allSlots"
      :stat-path="statPath"
      :stat-options="statOptions"
      :save-bonus="saveBonusExtra"
      :attack-bonus="attackBonusExtra"
      :slots-rest="slotsRest"
      :preparation="preparation"
      @change="(level, total) => $emit('set-total', level, total)"
      @set-stat-path="$emit('set-stat-path', $event)"
      @set-save-bonus="$emit('set-save-bonus', $event)"
      @set-attack-bonus="$emit('set-attack-bonus', $event)"
      @set-slots-rest="$emit('set-slots-rest', $event)"
      @set-preparation="$emit('set-preparation', $event)"
      @close="editOpen = false"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'

import DndSpellbookSettingsModal from '@/features/character-editor/blocks/dnd/DndSpellbookSettingsModal.vue'
import SpellSlotSphere from '@/features/items/components/SpellSlotSphere.vue'
import SheetBlockTitle from '@/shared/ui/SheetBlockTitle'

const editOpen = ref(false)

defineProps({
  hasStatConfig:   { type: Boolean, default: false },
  canInteract:     { type: Boolean, default: false },
  statPath:        { default: '' },
  statOptions:     { type: Array, default: () => [] },
  statLabel:       { type: String, default: '' },
  saveDC:          { type: Number, default: 0 },
  attackBonus:     { type: Number, default: 0 },
  saveBonusExtra:   { type: Number, default: 0 },
  attackBonusExtra: { type: Number, default: 0 },
  slotsRest:       { type: String, default: 'long_rest' },
  preparation:     { type: Boolean, default: false },
  activeSlots:     { type: Array, default: () => [] },
  allSlots:        { type: Array, default: () => [] },
})
defineEmits(['set-stat-path', 'set-total', 'set-save-bonus', 'set-attack-bonus', 'set-slots-rest', 'set-preparation', 'toggle-slot'])

function orbOrder(total) {
  return Array.from({ length: total }, (_, k) => total - k)
}
</script>

<style scoped>
.sp-bar {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-bottom: 18px;
}

.sp-mobile-panel-head { margin-bottom: 12px; }

.sp-slots-head { margin-bottom: 12px; }

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
    border-radius: var(--r-lg);
    background: var(--surface);
    box-shadow: inset 0 0 0 1px var(--border);
  }

  .sp-stats {
    flex-wrap: nowrap;
    gap: 0;
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

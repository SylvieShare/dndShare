<template>
  <div class="step">
    <div class="sheet-section-title">Снаряжение</div>
    <p class="hint">Снаряжение класса и предыстории добавится в инвентарь автоматически. Стартовые монеты из предыстории попадут в кошелёк. Здесь можно проверить набор и добавить другие предметы.</p>

    <div v-if="classEquipment.length || backgroundStart.items.length || moneyLabel" class="refs">
      <div v-if="classEquipment.length" class="ref">
        <span class="ref-k">Выбрано от класса</span>
        <span class="ref-v">{{ equipmentLabel(classEquipment) }}</span>
      </div>
      <div v-if="backgroundStart.items.length" class="ref">
        <span class="ref-k">Выбрано от предыстории</span>
        <span class="ref-v">{{ equipmentLabel(backgroundStart.items) }}</span>
      </div>
      <div v-if="moneyLabel" class="ref">
        <span class="ref-k">В кошелёк</span>
        <span class="ref-v">{{ moneyLabel }}</span>
      </div>
    </div>

    <div v-if="state.equipment.length" class="items">
      <div v-for="e in state.equipment" :key="e.id" class="row">
        <span class="row-name">{{ e.name }}</span>
        <div class="qty">
          <button class="q-btn" @click="bumpEquipment(e.id, -1)">−</button>
          <span class="q-val">{{ e.count }}</span>
          <button class="q-btn" @click="bumpEquipment(e.id, 1)">+</button>
        </div>
        <button class="row-x" title="Убрать" @click="removeEquipment(e.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </div>

    <button class="add" @click="pickerOpen = true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
      Добавить предмет
    </button>

    <ItemPickerModal
      v-if="pickerOpen"
      :item-type-ids="[2, 1, 10]"
      title="Снаряжение"
      search-placeholder="Поиск предмета…"
      allow-quantity
      @pick="onPick"
      @close="pickerOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import { backgroundStartingEquipment, formatStartingCoins } from '@/features/character-editor/settings/dnd/creation/backgroundEquipment'

const { state, classEquipment, addEquipment, removeEquipment, bumpEquipment } = inject('createWizard')

const pickerOpen = ref(false)
function onPick(item, qty = 1) { addEquipment(item, qty) }
const backgroundStart = computed(() => backgroundStartingEquipment(state.background))
const moneyLabel = computed(() => formatStartingCoins(backgroundStart.value.coins))
function equipmentLabel(items) {
  return items.map((entry) => entry.count > 1 ? `${entry.name} ×${entry.count}` : entry.name).join(', ')
}
</script>

<style scoped>
.step { display: flex; flex-direction: column; gap: 12px; }
.hint { font-size: 12px; color: var(--text-muted); margin: 0; }
.refs { display: flex; flex-direction: column; gap: 8px; }
.ref { background: var(--surface); border-radius: var(--r-md); padding: 10px 13px; }
.ref-k { display: block; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--accent); margin-bottom: 3px; }
.ref-v { font-size: 12px; color: var(--text-2); line-height: 1.4; }

.items { display: flex; flex-direction: column; }
.row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 4px;
}
.row + .row { border-top: 1px solid color-mix(in srgb, var(--text-on-accent) 7%, transparent); }
.row-name { flex: 1; font-size: 13px; color: var(--text-1); }
.qty { display: flex; align-items: center; gap: 5px; }
.q-btn {
  width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--border-strong);
  background: var(--surface-raised); color: var(--text-1); cursor: pointer; font-size: 15px; line-height: 1;
}
.q-btn:hover { background: var(--surface-raised); }
.q-val { min-width: 22px; text-align: center; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-1); }
.row-x {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border: none; border-radius: 6px;
  background: none; color: var(--text-muted); cursor: pointer;
}
.row-x:hover { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
.row-x svg { width: 13px; height: 13px; }

.add {
  align-self: flex-start;
  display: inline-flex; align-items: center; gap: 7px;
  background: var(--surface); border: none; border-radius: var(--r-md);
  color: var(--accent); font: inherit; font-size: 13px; font-weight: 600;
  padding: 9px 15px; cursor: pointer; transition: background 0.15s;
}
.add:hover { background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }
.add svg { width: 16px; height: 16px; }
</style>

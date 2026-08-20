<template>
  <section v-if="profile" class="equipment">
    <div class="equipment-heading">
      <div>
        <div class="sheet-section-title">Стартовое снаряжение</div>
        <p class="hint">Получите готовый комплект класса или откажитесь от него и купите всё за начальное богатство.</p>
      </div>
      <label class="shop-later">
        <input
          type="checkbox"
          :checked="state.buyStartingEquipment"
          @change="setBuyStartingEquipment($event.target.checked)"
        />
        <span>Закупиться потом в магазине</span>
      </label>
    </div>

    <div v-if="state.buyStartingEquipment" class="shop-notice">
      <ShoppingBag :size="20" aria-hidden="true" />
      <span>Комплект класса и снаряжение предыстории не начисляются. После характеристик появится шаг магазина со стартовым золотом вашего класса.</span>
    </div>

    <template v-else>
      <div v-for="(group, groupIndex) in profile.groups" :key="group.id" class="choice-group">
        <div class="choice-title">{{ group.label || `Выбор ${groupIndex + 1}` }}</div>

        <div
          v-for="entry in group.options"
          :key="entry.id"
          class="choice-option"
          :class="{ selected: optionSelected(group, entry) }"
        >
          <label class="choice-option-label">
            <input
              v-if="group.options.length > 1"
              type="radio"
              :name="`class-equipment-${profile.key}-${group.id}`"
              :checked="optionSelected(group, entry)"
              @change="selectEquipmentOption(group.id, entry.id)"
            />
            <span v-else class="single-mark" aria-hidden="true">•</span>
            <span>{{ entry.label }}</span>
          </label>

          <div v-if="entry.items.length" class="option-items">
            <ItemReferenceRow
              v-for="linked in entry.items"
              :key="linked.item?.id || linked.name"
              :item="linked.item || missingItem(linked)"
              :count="linked.count"
              :disabled="!linked.item"
              @activate="viewItem = linked.item"
            />
          </div>

          <div v-if="optionSelected(group, entry) && entry.picks?.length" class="concrete-picks">
            <template v-for="pick in entry.picks" :key="pick.id">
              <label v-for="index in pick.count" :key="`${pick.id}-${index}`" class="concrete-pick">
                <span>{{ pick.label }}<template v-if="pick.count > 1"> {{ index }}</template></span>
                <EquipmentItemSelect
                  :items="pick.options"
                  :model-value="pickValue(group.id, pick.id, index - 1)"
                  @update:model-value="setEquipmentPick(group.id, entry.id, pick.id, index - 1, $event)"
                />
              </label>
            </template>
          </div>
        </div>
      </div>

      <div v-if="profile.fixed.length || profile.fixedPicks.length" class="fixed">
        <span class="fixed-title">Также получите</span>
        <div class="fixed-items">
          <ItemReferenceRow
            v-for="entry in profile.fixed"
            :key="entry.item?.id || entry.name"
            :item="entry.item || missingItem(entry)"
            :count="entry.count"
            :disabled="!entry.item"
            @activate="viewItem = entry.item"
          />
        </div>
        <label v-for="pick in profile.fixedPicks" :key="pick.id" class="concrete-pick fixed-pick">
          <span>{{ pick.label }}</span>
          <EquipmentItemSelect
            :items="pick.options"
            :model-value="pickValue('__fixed', pick.id, 0)"
            @update:model-value="setEquipmentPick('__fixed', 'fixed', pick.id, 0, $event)"
          />
        </label>
      </div>
    </template>

    <ItemViewModal
      v-if="viewItem"
      :item="viewItem"
      :item-id="viewItem.id"
      :item-type-id="viewItem.typeId"
      @close="viewItem = null"
    />
  </section>
</template>

<script setup>
import { inject, ref } from 'vue'
import { ShoppingBag } from '@lucide/vue'
import EquipmentItemSelect from '@/features/character-list/components/wizard/EquipmentItemSelect.vue'
import ItemReferenceRow from '@/features/items/components/ItemReferenceRow.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'

const {
  state, classEquipmentProfile: profile,
  selectEquipmentOption, setEquipmentPick, setBuyStartingEquipment,
} = inject('createWizard')

const viewItem = ref(null)
const missingItem = (entry) => ({ id: `missing:${entry.name}`, name: `${entry.name} — нет в справочнике`, data: {} })

function optionSelected(group, entry) {
  const selected = state.classEquipmentChoices?.[group.id]?.optionId
  return selected === entry.id || (selected == null && group.options.length === 1)
}

function pickValue(groupId, pickId, index) {
  return state.classEquipmentChoices?.[groupId]?.picks?.[pickId]?.[index] || ''
}
</script>

<style scoped>
.equipment { display: flex; flex-direction: column; gap: 12px; }
.equipment-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.hint { max-width: 520px; margin: 3px 0 0; color: var(--text-muted); font-size: 12px; line-height: 1.4; }
.shop-later { flex: none; display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--r-md); color: var(--text-1); font-size: 12px; font-weight: 650; cursor: pointer; }
.shop-later input { width: 16px; height: 16px; margin: 0; accent-color: var(--accent); }
.shop-notice { display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border)); border-radius: var(--r-md); background: color-mix(in srgb, var(--accent) 9%, var(--surface)); color: var(--text-2); font-size: 12px; line-height: 1.5; }
.shop-notice svg { flex: none; color: var(--accent); }
.choice-group { display: flex; flex-direction: column; gap: 6px; padding: 11px 12px; border: 1px solid var(--border); border-radius: var(--r-md); background: color-mix(in srgb, var(--surface) 80%, transparent); }
.choice-title { margin-bottom: 1px; color: var(--text-muted); font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
.choice-option { display: flex; flex-direction: column; gap: 8px; padding: 8px; border: 1px solid transparent; border-radius: var(--r-md); }
.choice-option.selected { border-color: color-mix(in srgb, var(--accent) 30%, transparent); background: color-mix(in srgb, var(--accent) 7%, transparent); }
.choice-option-label { display: flex; align-items: flex-start; gap: 8px; color: var(--text-2); font-size: 13px; line-height: 1.35; cursor: pointer; }
.choice-option.selected .choice-option-label { color: var(--text-1); }
.choice-option-label input { margin: 2px 0 0; accent-color: var(--accent); }
.single-mark { color: var(--accent); font-size: 18px; line-height: 12px; }
.option-items, .fixed-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; padding-left: 25px; }
.concrete-picks { display: grid; gap: 9px; padding: 2px 0 1px 25px; }
.concrete-pick { display: grid; grid-template-columns: minmax(120px, .55fr) minmax(220px, 1.45fr); align-items: start; gap: 10px; color: var(--text-muted); font-size: 12px; }
.concrete-pick > span { padding-top: 11px; }
.fixed { display: flex; flex-direction: column; gap: 8px; padding: 11px 12px; border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border)); border-radius: var(--r-md); background: color-mix(in srgb, var(--accent) 6%, transparent); }
.fixed-title { color: var(--accent); font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
.fixed-items { padding-left: 0; }
.fixed-pick { grid-template-columns: minmax(120px, .55fr) minmax(220px, 1.45fr); }
@media (max-width: 700px) {
  .equipment-heading { flex-direction: column; gap: 10px; }
  .shop-later { width: 100%; box-sizing: border-box; }
  .option-items, .fixed-items { grid-template-columns: 1fr; padding-left: 0; }
  .concrete-picks { padding-left: 0; }
  .concrete-pick { grid-template-columns: 1fr; gap: 4px; }
  .concrete-pick > span { padding-top: 0; }
}
</style>

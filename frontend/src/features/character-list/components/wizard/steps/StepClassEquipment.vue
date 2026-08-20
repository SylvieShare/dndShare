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

        <div class="choice-options" :class="{ 'choice-options--paired': group.options.length === 2 }">
          <div
            v-for="entry in group.options"
            :key="entry.id"
            class="choice-option"
            :class="{ selected: optionSelected(group, entry) }"
          >
            <label class="choice-option-label">
              <input
                v-if="group.options.length > 1"
                class="choice-option-input"
                type="radio"
                :name="`class-equipment-${profile.key}-${group.id}`"
                :checked="optionSelected(group, entry)"
                @change="selectEquipmentOption(group.id, entry.id)"
              />
              <span class="choice-mark" aria-hidden="true">
                <ShieldCheck v-if="optionSelected(group, entry)" :size="19" />
                <Shield v-else :size="19" />
              </span>
              <span>{{ entry.label }}</span>
            </label>

            <div v-if="entry.items.length" class="option-items">
              <ItemReferenceRow
                v-for="linked in entry.items"
                :key="linked.item?.id || linked.name"
                :item="linked.item || missingItem(linked)"
                :count="linked.count"
                :selected="optionSelected(group, entry)"
                :disabled="!linked.item"
                show-details
                roomy-weapon
                @activate="selectOptionFromItem(group, entry)"
                @details="viewItem = linked.item"
              />
            </div>

            <div v-if="entry.picks?.length" class="concrete-picks">
              <template v-for="pick in entry.picks" :key="pick.id">
                <EquipmentItemSelect
                  v-for="index in pick.count"
                  :key="`${pick.id}-${index}`"
                  :items="pick.options"
                  :model-value="pickValue(group.id, entry.id, pick.id, index - 1)"
                  :placeholder="pickPlaceholder(pick, index)"
                  roomy-weapons
                  @update:model-value="setEquipmentPick(group.id, entry.id, pick.id, index - 1, $event)"
                  @details="viewItem = $event"
                />
              </template>
            </div>
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
            selected
            :disabled="!entry.item"
            :activatable="false"
            show-details
            roomy-weapon
            @details="viewItem = entry.item"
          />
        </div>
        <div v-for="pick in profile.fixedPicks" :key="pick.id" class="fixed-pick">
          <EquipmentItemSelect
            :items="pick.options"
            :model-value="pickValue('__fixed', 'fixed', pick.id, 0)"
            :placeholder="pickPlaceholder(pick, 1)"
            roomy-weapons
            @update:model-value="setEquipmentPick('__fixed', 'fixed', pick.id, 0, $event)"
            @details="viewItem = $event"
          />
        </div>
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
import { Shield, ShieldCheck, ShoppingBag } from '@lucide/vue'
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

function selectOptionFromItem(group, entry) {
  if (!optionSelected(group, entry)) selectEquipmentOption(group.id, entry.id)
}

function pickValue(groupId, optionId, pickId, index) {
  const choice = state.classEquipmentChoices?.[groupId]
  if (choice?.optionId !== optionId) return ''
  return choice.picks?.[pickId]?.[index] || ''
}

function pickPlaceholder(pick, index) {
  const suffix = pick.count > 1 ? ` ${index}` : ''
  return `Выберите: ${pick.label}${suffix}`
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
.choice-title { display: flex; align-items: center; gap: 9px; margin-bottom: 2px; color: var(--text-muted); font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
.choice-title::after { height: 1px; flex: 1; background: linear-gradient(90deg, var(--border-strong), transparent); content: ''; }
.choice-options { display: grid; gap: 0; }
.choice-options--paired { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.choice-option { min-width: 0; display: flex; flex-direction: column; gap: 8px; padding-block: 8px 4px; }
.choice-options:not(.choice-options--paired) .choice-option + .choice-option { margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--border); }
.choice-options--paired .choice-option:first-child { padding-right: 14px; }
.choice-options--paired .choice-option + .choice-option { padding-left: 14px; border-left: 1px solid var(--border); }
.choice-option-label { position: relative; display: flex; align-items: flex-start; gap: 8px; color: var(--text-2); font-size: 13px; line-height: 1.35; cursor: pointer; }
.choice-option.selected .choice-option-label { color: var(--text-1); }
.choice-option-input { position: absolute; z-index: 1; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; }
.choice-option-label > span { pointer-events: none; }
.choice-option-label:focus-within { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
.choice-mark { flex: none; display: grid; place-items: center; color: var(--text-muted); }
.choice-option.selected .choice-mark { color: var(--accent); }
.option-items, .fixed-items { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; padding-left: 25px; }
.concrete-picks { display: grid; gap: 9px; padding: 2px 0 1px 25px; }
.choice-options--paired .option-items { grid-template-columns: 1fr; padding-left: 0; }
.choice-options--paired .concrete-picks { padding-left: 0; }
.fixed { display: flex; flex-direction: column; gap: 8px; padding: 11px 12px; border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border)); border-radius: var(--r-md); background: color-mix(in srgb, var(--accent) 6%, transparent); }
.fixed-title { color: var(--accent); font-size: 10px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
.fixed-items { padding-left: 0; }
.fixed-pick { width: 100%; }
@media (max-width: 700px) {
  .equipment-heading { flex-direction: column; gap: 10px; }
  .shop-later { width: 100%; box-sizing: border-box; }
  .choice-options--paired { grid-template-columns: 1fr; }
  .choice-options--paired .choice-option:first-child { padding-right: 0; }
  .choice-options--paired .choice-option + .choice-option { margin-top: 8px; padding: 12px 0 4px; border-top: 1px solid var(--border); border-left: 0; }
  .option-items, .fixed-items { grid-template-columns: 1fr; padding-left: 0; }
  .concrete-picks { padding-left: 0; }
}
</style>

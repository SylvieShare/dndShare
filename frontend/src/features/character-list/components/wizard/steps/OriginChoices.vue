<template>
  <section v-if="originRules.backgroundAbilityScores" class="origin-choices">
    <AbilityBonusPicker v-model="state.backgroundAsi" :abilities="originAbilities" :patterns="[[2, 1], [1, 1, 1]]" />
    <section class="origin-feat" aria-label="Черта происхождения">
      <div class="sheet-section-title">Черта происхождения</div>
      <FeatListItem v-if="originFeat" :item="originFeat" interactive @activate="showReference = true" />
      <p v-else-if="state.background?.data?.origin_feat_id">Черта не загружена: проверьте источники.</p>
      <button v-if="!state.background?.data?.origin_feat_id" type="button" class="ability-link" @click="pickerOpen = true">{{ originFeat ? 'Изменить черту' : 'Выбрать черту' }}</button>
    </section>
    <button v-if="originFeat && actionableItemChoices(originFeat).length" type="button" class="ability-link" @click="configure = true">Настроить черту</button>
    <p v-if="!originComplete">Завершите распределение бонусов и выбор черты. При повторном получении Посвящённого в магию выберите другой класс.</p>
    <FormField label="Снаряжение предыстории" vertical>
      <FormSelect :value="state.backgroundTakeGold ? 'gold' : 'kit'" @update:value="state.backgroundTakeGold = $event === 'gold'">
        <option value="kit">Комплект предыстории</option>
        <option value="gold">{{ state.background?.data?.starting_gold || 50 }} зм вместо комплекта</option>
      </FormSelect>
    </FormField>
    <FeatChoiceModal v-if="configure && originFeat" :item="originFeat" :initial-choices="state.originFeatChoices" @confirm="saveChoices" @close="configure = false" />
    <ItemViewModal v-if="showReference && originFeat" :item-id="originFeat.id" :item-type-id="7" @close="showReference = false" />
    <ItemPickerModal v-if="pickerOpen" :item-type-ids="[7]" title="Черта происхождения" :fixed-filters="{ category: ['origin'] }" :item-eligibility="originEligibility" @pick="selectFeat" @close="pickerOpen = false" />
  </section>
</template>
<script setup>
import { inject, ref } from 'vue'
import { FormField, FormSelect } from '@sylvieshare/share-ui'
import AbilityBonusPicker from '@/shared/ui/AbilityBonusPicker.vue'
import FeatListItem from '@/features/items/list-components/FeatListItem.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
import ItemPickerModal from '@/features/handbook/components/ItemPickerModal.vue'
import { actionableItemChoices } from '@/features/items/lib/itemChoices'
import FeatChoiceModal from '@/features/character-editor/components/FeatChoiceModal.vue'
const { state, originRules, originAbilities, originFeat, originComplete, selectOriginFeat } = inject('createWizard')
const configure = ref(false)
const showReference = ref(false)
const pickerOpen = ref(false)
function saveChoices(choices) { state.originFeatChoices = choices; configure.value = false }
function originEligibility(item) {
  if (item?.data?.category !== 'origin') return { eligible: false, reasons: ['Нужна черта происхождения'] }
  if (!item.data.repeatable && state.featIds?.some(id => Number(id) === Number(item.id))) return { eligible: false, reasons: ['Черта уже выбрана'] }
  return { eligible: true, reasons: [] }
}
function selectFeat(item) {
  if (!originEligibility(item).eligible) return
  if (!selectOriginFeat(item)) return
  pickerOpen.value = false
  configure.value = actionableItemChoices(item).length > 0
}
</script>

<style scoped>
.origin-choices, .origin-feat { display: flex; flex-direction: column; gap: 12px; }
.origin-feat { min-width: 0; }
.ability-link { align-self: flex-start; padding: 6px 0; border: 0; background: transparent; color: var(--accent); font: inherit; cursor: pointer; }
.origin-choices p { margin: 0; color: var(--text-muted); font-size: 12px; line-height: 1.4; }
</style>

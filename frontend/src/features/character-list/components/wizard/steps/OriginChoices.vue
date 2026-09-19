<template>
  <section v-if="originRules.backgroundAbilityScores">
    <p>Предыстория: +2 к одной и +1 к другой характеристике либо +1 к трём. Максимум при создании — 20.</p>
    <FormField v-for="stat in originAbilities" :key="stat" :label="STAT_FULL[stat]" vertical>
      <FormSelect :value="state.backgroundAsi[stat] || 0" @update:value="state.backgroundAsi = { ...state.backgroundAsi, [stat]: Number($event) }">
        <option :value="0">Без бонуса</option><option :value="1">+1</option><option :value="2">+2</option>
      </FormSelect>
    </FormField>
    <FormField label="Черта происхождения" vertical>
      <span v-if="state.background?.data?.origin_feat_id">{{ originFeat?.name || 'Черта не загружена: проверьте источники' }}</span>
      <FormSelect v-else :value="state.originFeatId || ''" @update:value="state.originFeatId = Number($event) || null; state.originFeatChoices = {}">
        <option value="">Выберите черту</option>
        <option v-for="feat in originFeatOptions" :key="feat.id" :value="feat.id">{{ feat.name }}</option>
      </FormSelect>
    </FormField>
    <button v-if="originFeat && actionableItemChoices(originFeat).length" type="button" class="ability-link" @click="configure = true">Настроить черту</button>
    <p v-if="!originComplete">Завершите распределение бонусов и выбор черты. При повторном получении Посвящённого в магию выберите другой класс.</p>
    <FormField label="Снаряжение предыстории" vertical>
      <FormSelect :value="state.backgroundTakeGold ? 'gold' : 'kit'" @update:value="state.backgroundTakeGold = $event === 'gold'">
        <option value="kit">Комплект предыстории</option>
        <option value="gold">{{ state.background?.data?.starting_gold || 50 }} зм вместо комплекта</option>
      </FormSelect>
    </FormField>
    <FeatChoiceModal v-if="configure && originFeat" :item="originFeat" :initial-choices="state.originFeatChoices" @confirm="saveChoices" @close="configure = false" />
  </section>
</template>
<script setup>
import { inject, ref } from 'vue'
import { FormField, FormSelect } from '@sylvieshare/share-ui'
import { STAT_FULL } from '@/shared/lib/dndStats'
import { actionableItemChoices } from '@/features/items/lib/itemChoices'
import FeatChoiceModal from '@/features/character-editor/components/FeatChoiceModal.vue'
const { state, originRules, originAbilities, originFeat, originFeatOptions, originComplete } = inject('createWizard')
const configure = ref(false)
function saveChoices(choices) { state.originFeatChoices = choices; configure.value = false }
</script>

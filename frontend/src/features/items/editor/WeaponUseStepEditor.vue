<template>
  <div class="ability-action-fields">
    <AbilityRuleFields :fields="pick(['title'])" :data="data" @update:data="update" />
    <RuleKeyField v-model="data.key" :title="data.title" :used-keys="otherKeys" />
    <AbilityRuleFields :fields="pick(['kind'])" :data="data" @update:data="setKind" />
    <AbilityRuleFields :fields="pick(['dice', 'dice_count', 'damage_type'])" :data="data" @update:data="update" />
    <FormField label="Условия" title="По одному условию на строку. Для урона оружия укажите, по какой цели должно быть попадание." vertical><FormTextarea :value="(data.requirements || []).join('\n')" aria-label="Условия шага" @update:value="value => data.requirements = value.split('\n').filter(Boolean)" /></FormField>
    <template v-if="data.kind === 'damage'">
      <FormField label="Есть спасбросок" title="Урон по спасброску не зависит от критического попадания по другой цели."><ToggleSwitch :model-value="!!data.save" aria-label="Есть спасбросок" @update:model-value="value => value ? data.save = { ability: 2, dc: 13, half: true } : delete data.save" /></FormField>
      <AbilityRuleFields v-if="data.save" :fields="fields.find(f => f.key === 'save').fields" :data="data.save" @update:data="value => Object.assign(data.save, value)" />
      <FormField label="Область — линия" title="Длина линии берётся из дистанции особого применения. Здесь задаётся ширина."><ToggleSwitch :model-value="!!data.area" aria-label="Область — линия" @update:model-value="value => value ? data.area = { shape: 'line', width_ft: 5 } : delete data.area" /></FormField>
      <AbilityRuleFields v-if="data.area" :fields="fields.find(f => f.key === 'area').fields.filter(f => f.key === 'width_ft')" :data="data.area" @update:data="value => Object.assign(data.area, value)" />
    </template>
  </div>
</template>
<script setup>
import { FormField, FormTextarea, ToggleSwitch } from '@sylvieshare/share-ui'
import AbilityRuleFields from './AbilityRuleFields.vue'
import RuleKeyField from './RuleKeyField.vue'
const props = defineProps({ data: Object, fields: Array, otherKeys: Array })
const pick = keys => props.fields.filter(f => keys.includes(f.key))
function update(value) { Object.assign(props.data, value) }
function setKind(value) { update(value); if (props.data.kind !== 'damage') { delete props.data.save; delete props.data.area } }
</script>

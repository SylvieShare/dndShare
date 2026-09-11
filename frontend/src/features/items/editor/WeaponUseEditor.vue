<template>
  <div class="ability-action-fields">
    <AbilityRuleFields :fields="fields.filter(f => f.key === 'title')" :data="data" @update:data="update" />
    <RuleKeyField v-model="data.key" :title="data.title" :used-keys="otherKeys" />
    <AbilityRuleFields :fields="fields.filter(f => f.key === 'attack_mode' || (f.key === 'range_ft' && (data.attack_mode !== 'melee' || data.steps?.some(step => step.area))))" :data="data" @update:data="update" />
    <FormField label="Расходует ресурс при атаке" title="Расход происходит сразу при броске атаки, независимо от попадания. Шаги после атаки повторно его не списывают."><ToggleSwitch :model-value="Number(data.resource_cost) > 0" aria-label="Расходует ресурс при атаке" @update:model-value="value => data.resource_cost = value ? 1 : 0" /></FormField>
    <template v-if="Number(data.resource_cost) > 0">
      <FormField v-if="resources.length > 1 || missingResource" label="Ресурс" title="Основной или отдельный ресурс этого экземпляра." vertical><FormSelect :value="data.resource_key || ''" aria-label="Ресурс особого применения" @update:value="value => data.resource_key = value || undefined"><option v-for="r in resources" :key="r.key" :value="r.key">{{ r.title }}</option><option v-if="missingResource" :value="data.resource_key || ''">Выберите доступный ресурс</option></FormSelect></FormField>
      <AbilityRuleFields :fields="fields.filter(f => f.key === 'resource_cost')" :data="data" @update:data="update" />
    </template>
    <div v-for="(step, index) in data.steps || []" :key="step" class="weapon-use-editor-step">
      <RemoveButton icon="trash" :label="`Удалить шаг ${step.title || index + 1}`" @click="removing = step" />
      <details open><summary>{{ step.title || `Шаг ${index + 1}` }}</summary><WeaponUseStepEditor :data="step" :fields="stepFields" :other-keys="(data.steps || []).filter(row => row !== step).map(row => row.key)" /></details>
    </div>
    <AddButton @click="addStep">Добавить шаг после атаки</AddButton>
    <ConfirmDialog v-if="removing" title="Удалить шаг?" message="Шаг будет удалён из этого применения после сохранения предмета." confirm-text="Удалить" @confirm="data.steps = data.steps.filter(row => row !== removing); removing = null" @close="removing = null" @cancel="removing = null" />
  </div>
</template>
<script setup>
import { computed, inject, onScopeDispose, ref, watch, watchEffect } from 'vue'
import { AddButton, ConfirmDialog, FormField, FormSelect, RemoveButton, ToggleSwitch } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { weaponUseError } from '@/features/character-editor/lib/weaponUses'
import AbilityRuleFields from './AbilityRuleFields.vue'
import RuleKeyField from './RuleKeyField.vue'
import WeaponUseStepEditor from './WeaponUseStepEditor.vue'
import { itemResourceOptions } from './itemResourceOptions'
const props = defineProps({ data: Object, fields: Array })
const editor = inject(itemFieldEditorKey, {}), validationKey = Symbol('weapon-use'), removing = ref(null)
const resources = computed(() => itemResourceOptions(editor.itemData))
const missingResource = computed(() => !resources.value.some(row => row.key === (props.data.resource_key || '')))
const stepFields = computed(() => props.fields.find(f => f.key === 'steps')?.fields || [])
const otherKeys = computed(() => (editor.itemData?.weapon_uses || []).filter(row => row !== props.data).map(row => row.key))
watch(resources, rows => { if (rows.length === 1 && !props.data.resource_key) props.data.resource_key = rows[0].key || undefined }, { immediate: true })
watchEffect(() => editor.setValidationError?.(validationKey, weaponUseError(props.data) || (otherKeys.value.includes(props.data.key) ? 'Ключи особых применений не должны повторяться.' : '') || (Number(props.data.resource_cost) > 0 && missingResource.value ? 'Добавьте и выберите ресурс особого применения.' : '')))
onScopeDispose(() => editor.setValidationError?.(validationKey, ''))
function update(value) { Object.assign(props.data, value) }
function addStep() { props.data.steps = [...(props.data.steps || []), { kind: 'damage', dice: 'd6', dice_count: 1 }] }
</script>
<style scoped>
.weapon-use-editor-step { position: relative; padding: 8px 0 8px 12px; border-left: 2px solid var(--border); }
.weapon-use-editor-step > :first-child { position: absolute; right: 0; top: 6px; }
.weapon-use-editor-step summary { padding-right: 32px; margin-bottom: 12px; cursor: pointer; color: var(--text-1); font-size: 13px; font-weight: 650; }
</style>

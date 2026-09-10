<template>
  <div class="ability-action-fields">
    <AbilityRuleFields :fields="fieldsFor(['label'])" :data="data" @update:data="update" />
    <RuleKeyField :model-value="data.key" :title="data.label" :used-keys="otherKeys" @update:model-value="setKey" />
    <AbilityRuleFields :fields="fieldsFor(['weapon_kind', 'dice'])" :data="data" @update:data="update" />
    <FormField label="Количество костей растёт с уровнем" title="Источник уровня указан ниже и настраивается у способности.">
      <ToggleSwitch :model-value="scaled" aria-label="Количество костей растёт с уровнем" @update:model-value="setScaled" />
    </FormField>
    <AbilityRuleFields :fields="fieldsFor(scaled ? ['dice_count_level_divisor', 'dice_count_rounding'] : ['dice_count'])" :data="data" @update:data="update" />
    <AbilityLevelSource v-if="scaled" :data="editor.itemData || {}" readonly />
    <div v-if="data.dice" class="ability-progression-preview" aria-label="Предпросмотр урона по уровням">
      <span v-for="row in preview" :key="row.level"><small>{{ row.level }} ур.</small><strong>{{ row.value }}</strong></span>
    </div>
    <AbilityRuleFields :fields="fieldsFor(['double_on_critical', 'once_per_turn'])" :data="data" @update:data="update" />
    <AbilityUnlockField :data="data" />
  </div>
</template>
<script setup>
import { computed, inject, onScopeDispose, watchEffect } from 'vue'
import { FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { weaponDamageLabel } from '@/shared/lib/abilityProgression'
import { renameWeaponDamageKey } from './actionEditorModel'
import RuleKeyField from './RuleKeyField.vue'
import AbilityLevelSource from './AbilityLevelSource.vue'
import AbilityRuleFields from './AbilityRuleFields.vue'
import AbilityUnlockField from './AbilityUnlockField.vue'
const props = defineProps({ data: Object, fields: Array })
const editor = inject(itemFieldEditorKey, {})
const scaled = computed(() => props.data.dice_count_level_divisor != null)
const overrides = {
  label: { name: 'Название переключателя', hint: 'Так дополнительный урон будет называться в меню оружия.' },
  dice_count_level_divisor: { name: 'Одна кость на каждые N уровней', hint: 'Для Скрытой атаки: 2 уровня и округление вверх. На уровнях 1–2 будет 1 кость, на 3–4 — 2.' },
  dice_count_rounding: { name: 'Неполную группу уровней', options: [{ value: 'up', label: 'Считать за целую' }, { value: 'down', label: 'Не учитывать' }] },
  once_per_turn: { name: 'Не чаще раза за ход', hint: 'Памятка игроку; приложение не отслеживает ходы и выполнение условий скрытой атаки.' },
}
const fieldsFor = keys => keys.map(key => props.fields.find(field => field.key === key)).filter(Boolean).map(field => ({ ...field, ...overrides[field.key] }))
const preview = computed(() => Array.from({ length: 20 }, (_, i) => ({ level: i + 1, value: weaponDamageLabel(props.data, i + 1) }))
  .filter((row, i, rows) => row.value && (!i || row.value !== rows[i - 1].value)))
const otherKeys = computed(() => (editor.itemData?.weapon_damage || []).filter(row => row !== props.data).map(row => row.key))
function setKey(value) { renameWeaponDamageKey(editor.itemData || {}, props.data, value) }
function update(value) { Object.assign(props.data, value) }
function setScaled(value) {
  if (value) { delete props.data.dice_count; props.data.dice_count_level_divisor = 2; props.data.dice_count_rounding = 'up' }
  else { delete props.data.dice_count_level_divisor; delete props.data.dice_count_rounding; props.data.dice_count = 1 }
}
const validationKey = Symbol('weapon-damage')
watchEffect(() => {
  const count = Number(scaled.value ? props.data.dice_count_level_divisor : props.data.dice_count)
  editor.setValidationError?.(validationKey, !props.data.key || otherKeys.value.includes(props.data.key) || !props.data.dice || !Number.isInteger(count) || count < 1 ? 'Дополнительный урон: задайте уникальный ключ, кость и целое положительное количество или шаг уровней.' : '')
})
onScopeDispose(() => editor.setValidationError?.(validationKey, ''))
</script>

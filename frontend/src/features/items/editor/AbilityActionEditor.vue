<template>
  <div class="ability-action-fields">
    <FormField label="Название действия" vertical title="Так действие будет называться на листе персонажа.">
      <FormTextInput v-model:value="data.title" placeholder="Например, Яростный удар" aria-label="Название действия" />
    </FormField>
    <RuleKeyField v-model="data.key" :title="data.title" :used-keys="otherKeys" />
    <AbilityRuleFields :fields="typeFields" :data="data" @update:data="update" />
    <FormField label="Описание" vertical title="Один тезис — одно правило: цель, результат, ограничение. Используйте маркированный список; не повторяйте название, вид действия и стоимость. Ссылки и кости можно вставлять в текст.">
      <InputDescription editable :block="{ id: 'description', content: { placeholder: 'Короткие тезисы: цель → результат → ограничения…' } }" :value="data.description || ''" @update:value="(_, value) => data.description = value" />
      <FormSelect :disabled="standardLoading" value="" aria-label="Вставить ссылку на стандартное действие" @update:value="insertStandardAction">
        <option value="">{{ standardLoading ? 'Загрузка стандартных действий…' : 'Вставить стандартное действие…' }}</option>
        <option v-for="entry in standardActions" :key="entry.id" :value="entry.id">{{ entry.value }}</option>
      </FormSelect>
      <LoadingIndicator v-if="standardLoading" label="Загрузка стандартных действий" size="xs" />
      <button v-if="standardError" class="ability-link" type="button" @click="loadStandardActions">Не удалось загрузить стандартные действия. Повторить</button>
    </FormField>
    <FormField label="Расходовать ресурс" vertical title="Если выключено, действие не списывает использования. Если включено, выберите, откуда и сколько списывать.">
      <ToggleSwitch :model-value="resourceMode !== 'none'" aria-label="Расходовать ресурс" @update:model-value="value => setResourceMode(value ? 'self' : 'none')" />
    </FormField>
    <template v-if="resourceMode !== 'none'">
      <FormField label="Источник расхода" vertical title="У действия может быть один источник расхода: основной, отдельный ресурс или общий ресурс класса.">
        <FormSelect :value="resourceMode" aria-label="Источник расхода" @update:value="setResourceMode">
          <option value="self">{{ editor.itemTypeId === 19 ? 'Заряды этого предмета' : 'Основной ресурс этой способности' }}</option>
          <option value="selected">{{ editor.itemTypeId === 19 ? 'Выбрать ресурс' : 'Выбрать ресурс способности' }}</option>
          <option value="pool">Общий ресурс класса</option>
        </FormSelect>
      </FormField>
      <FormField v-if="resourceMode !== 'self'" :label="resourceMode === 'pool' ? 'Общий ресурс' : 'Ресурс'" vertical title="Поиск по названию ресурса, ключу и предмету, который его предоставляет.">
        <RuleReferencePicker :kind="resourceMode === 'pool' ? 'resource_pool' : 'resource'" :value="resourceMode === 'pool' ? data.resource_pool_key : data.resource_key" :owner-id="resourceMode === 'pool' ? null : data.resource_item_id" label="Выбрать ресурс" @pick="pickResource" />
      </FormField>
      <AbilityRuleFields :fields="costFields" :data="data" @update:data="update" />
    </template>
    <details class="ability-advanced" :open="hasConditions || undefined">
      <summary>Условия появления</summary>
      <div class="ability-action-fields">
        <FormField label="Какие эффекты должны быть активны" vertical title="Выберите эффекты из справочника. Действие появляется, только когда активны все выбранные эффекты. Сохраняются их коды, вводить ID не нужно.">
          <RuleReferenceList v-model="data.required_status_codes" kind="status" label="Активный эффект" />
        </FormField>
        <FormField label="Условия применения" vertical title="Памятки для игрока, по одной на строку. Автоматически не проверяются.">
          <FormTextarea :value="(data.requirements || []).join('\n')" aria-label="Условия применения" placeholder="Например, только после входа в ярость" @update:value="value => data.requirements = value.split('\n').filter(Boolean)" />
        </FormField>
        <FormField label="Открыть действие позже" vertical title="Уровень способности слева отвечает за её получение. Этот отдельный порог нужен, если действие открывается позднее; для классовой способности проверяется уровень класса.">
          <ToggleSwitch :model-value="later" aria-label="Открыть действие позже" @update:model-value="setLater" />
        </FormField>
        <AbilityRuleFields v-if="later" :fields="levelFields" :data="data" @update:data="update" />
      </div>
    </details>
    <details class="ability-advanced" :open="!!data.target_kind || undefined">
      <summary>Применение эффекта к оружию</summary>
      <div class="ability-action-fields">
        <FormField label="Выбирать оружие при использовании" vertical title="Игрок выбирает оружие, к которому будет применён указанный эффект."><ToggleSwitch :model-value="data.target_kind === 'weapon'" aria-label="Выбирать оружие" @update:model-value="setWeaponTarget" /></FormField>
        <FormField v-if="data.target_kind === 'weapon'" label="Накладываемый эффект" vertical title="Эффект из справочника, который получает выбранное оружие.">
          <RuleReferencePicker kind="status" :value="data.status_effect_code" label="Накладываемый эффект" @pick="entry => data.status_effect_code = entry.key" />
        </FormField>
      </div>
    </details>
    <details class="ability-advanced" :open="!!data.menu_effects?.length || undefined">
      <summary>Пункты меню</summary>
      <AbilityActionMenu :model-value="data.menu_effects || []" @update:model-value="value => data.menu_effects = value" />
    </details>
    <details v-if="extraFields.length" class="ability-advanced"><summary>Особые настройки</summary><AbilityRuleFields :fields="extraFields" :data="data" @update:data="update" /></details>
  </div>
</template>
<script setup>
import { LoadingIndicator } from '@sylvieshare/share-ui'
import { computed, inject, onMounted, onScopeDispose, ref, watchEffect } from 'vue'
import { FormField, FormSelect, FormTextInput, FormTextarea, ToggleSwitch, createRichNodeHtml } from '@sylvieshare/share-ui'
import { itemFieldEditorKey } from '@/features/character-editor/components/useItemFieldEditor'
import { useSuggestStore } from '@/stores/suggest'
import InputDescription from '@/shared/ui/InputDescription.vue'
import AbilityRuleFields from './AbilityRuleFields.vue'
import AbilityActionMenu from './AbilityActionMenu.vue'
import RuleKeyField from './RuleKeyField.vue'
import RuleReferencePicker from './RuleReferencePicker.vue'
import RuleReferenceList from './RuleReferenceList.vue'
import { actionEditorError, normalizeActionResource, changeActionResource } from './actionEditorModel'
const props = defineProps({ data: { type: Object, required: true }, fields: { type: Array, default: () => [] } })
const editor = inject(itemFieldEditorKey, {})
const suggestStore = useSuggestStore()
const standardLoading = ref(false), standardError = ref(false)
const standardActions = computed(() => suggestStore.items(24).filter(entry => entry.code))
const otherKeys = computed(() => (editor.itemData?.feature_actions || []).filter(row => row !== props.data).map(row => row.key))
const resourceMode = ref(normalizeActionResource(props.data))
const validationKey = Symbol('action')
watchEffect(() => editor.setValidationError?.(validationKey, actionEditorError(props.data, resourceMode.value, editor.itemData || {}, otherKeys.value)))
onScopeDispose(() => editor.setValidationError?.(validationKey, ''))
const later = ref(Number(props.data.level) > Math.max(1, Number(editor.itemData?.level) || 1))
const hasConditions = computed(() => props.data.required_status_codes?.length || props.data.requirements?.length || later.value)
const typeFields = computed(() => props.fields.filter(field => field.key === 'action_type'))
const costFields = [{ key: 'resource_cost', type: 'int', name: 'Использований за одно действие', hint: 'Сколько использований выбранного ресурса списать. 0 — не списывать автоматически.' }]
const levelFields = [{ key: 'level', type: 'int', name: 'Доступно с уровня', hint: 'Минимальный уровень персонажа или связанного класса для этого действия.' }]
const handled = new Set(['key','title','action_type','description','suggest_action_codes','requirements','required_status_codes','uses_resource','resource_item_id','resource_pool_key','resource_key','resource_cost','level','target_kind','status_effect_code','menu_effects'])
const extraFields = computed(() => props.fields.filter(field => (!handled.has(field.key) || (field.key === 'suggest_action_codes' && props.data.suggest_action_codes?.length)) && (field.key !== 'target_parameter' || props.data.target_kind)))
function update(value) { Object.assign(props.data, value) }
function setResourceMode(mode) { resourceMode.value = mode; changeActionResource(props.data, mode) }
function pickResource(entry) {
  const cost = props.data.resource_cost
  const own = !entry.itemId || Number(entry.itemId) === Number(editor.itemId)
  if (resourceMode.value === 'selected' && own && !entry.key) resourceMode.value = 'self'
  changeActionResource(props.data, resourceMode.value, own ? { ...entry, itemId: null } : entry)
  props.data.resource_cost = cost ?? 1
}
function setLater(value) { later.value = value; if (value) props.data.level = Math.max(1, Number(editor.itemData?.level) || 1) + 1; else delete props.data.level }
function setWeaponTarget(value) { props.data.target_kind = value ? 'weapon' : ''; if (!value) { delete props.data.status_effect_code; delete props.data.target_parameter } }
function insertStandardAction(id) {
 const entry = standardActions.value.find(entry => entry.id === Number(id))
 if (!entry) return
 props.data.description = `${props.data.description || ''}<p>${createRichNodeHtml('suggest', { id: entry.id, typeId: 24 }, entry.value)}</p>`
}
async function loadStandardActions() {
 standardLoading.value = true; standardError.value = false
 try { await suggestStore.ensure(24) }
 catch { standardError.value = true; return }
 finally { standardLoading.value = false }
 const codes = props.data.suggest_action_codes || []
 props.data.suggest_action_codes = codes.filter(code => {
  const entry = standardActions.value.find(entry => entry.code === code)
  if (!entry) return true
  insertStandardAction(entry.id)
  return false
 })
}
onMounted(loadStandardActions)
</script>

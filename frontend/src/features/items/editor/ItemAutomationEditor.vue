<template>
  <details class="ability-advanced item-automation-editor">
    <summary>Поддержка механик <span>{{ status.label }}</span></summary>
    <div class="ability-action-fields">
      <FormField label="Автоматизация" :title="status.hint" vertical>
        <FormSelect v-model:value="data.automationStatus" aria-label="Автоматизация">
          <option v-for="option in AUTOMATION_STATUSES" :key="option.value" :value="option.value" :title="option.hint">{{ option.label }}</option>
        </FormSelect>
      </FormField>
      <FormField label="Требует взаимодействия с другим игроком" :title="PLAYER_INTERACTION_HINT">
        <ToggleSwitch v-model="data.requiresPlayerInteraction" aria-label="Требует взаимодействия с другим игроком" />
      </FormField>
      <FormField label="Комментарий к поддержке" title="Необязательное пояснение: что поддержано, что нужно учитывать вручную или согласовывать с другим игроком. Показывается в подсказке к статусу. До 1000 символов." vertical>
        <FormTextarea v-model:value="data.automationNote" aria-label="Комментарий к поддержке" :maxlength="1000" placeholder="Например: заряды учитываются; эффект на союзнике отмечается вручную." />
      </FormField>
    </div>
  </details>
</template>
<script setup>
import { computed } from 'vue'
import { FormField, FormSelect, FormTextarea, ToggleSwitch } from '@sylvieshare/share-ui'
import { AUTOMATION_STATUSES, PLAYER_INTERACTION_HINT, automationStatus } from '../lib/itemAutomation'
const props = defineProps({ data: { type: Object, required: true } })
const status = computed(() => automationStatus(props.data.automationStatus))
</script>

<template>
  <FormField v-if="types.required(entry)" :label="types.ready(entry) ? 'Тип урона' : 'Выберите тип урона'" vertical>
    <div class="spell-damage-types" role="group" aria-label="Тип урона">
      <ActionButton v-for="type in types.options(entry)" :key="type.value"
        :variant="types.selected(entry)?.value === type.value ? 'primary' : 'secondary'"
        :aria-pressed="types.selected(entry)?.value === type.value" :disabled="disabled"
        @click.stop="types.select(entry, type.value)">
        <template #icon><SvgIcon v-if="type.svg" :svg="type.svg" :color="type.color" :size="18" /></template>
        {{ type.label }}
      </ActionButton>
    </div>
  </FormField>
</template>
<script setup>
import { inject } from 'vue'
import { ActionButton, FormField } from '@sylvieshare/share-ui'
import SvgIcon from '@/shared/ui/SvgIcon.vue'
defineProps({ entry: { type: Object, required: true }, disabled: Boolean })
const types = inject('spellsBlockCtx').spellDamageTypes
</script>
<style scoped>
.spell-damage-types { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; }
.spell-damage-types > button { justify-content: flex-start; padding: 6px 8px; font-size: 12px; }
</style>

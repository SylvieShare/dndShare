<template>
  <header class="inspector-entity-heading">
    <component :is="icon" v-if="icon" :size="20" class="inspector-entity-icon" :style="{ color: color || 'var(--text-muted)' }" aria-hidden="true" />
    <slot name="before-name" />
    <h3 :aria-label="name">
      <InlineEdit v-if="editable" :model-value="value ?? name" :display-value="name" :label="label" :edit-label="`Изменить ${label.toLowerCase()}`" confirm-label="Сохранить название" cancel-label="Отменить изменение названия" required :maxlength="maxlength" :disabled="disabled" @confirm="emit('rename', String($event).trim())">
        <span v-if="prefix" class="inspector-entity-prefix">{{ prefix }} · </span>{{ value || name }}
      </InlineEdit>
      <template v-else><span v-if="prefix" class="inspector-entity-prefix">{{ prefix }} · </span>{{ prefix ? value : name }}</template>
    </h3>
    <slot name="metadata" />
  </header>
</template>
<script setup>
import { InlineEdit } from '@sylvieshare/share-ui'
defineProps({ name: String, value: { default: null }, prefix: String, color: String, icon: [Object, Function], editable: Boolean, disabled: Boolean, label: { type: String, default: 'Название' }, maxlength: { type: Number, default: 100 } })
const emit = defineEmits(['rename'])
</script>
<style scoped>
.inspector-entity-heading { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.inspector-entity-icon { flex: none; }
h3 { margin: 0; font-size: 18px; min-width: 0; max-width: calc(100% - 28px); overflow-wrap: anywhere; --inline-edit-min-width: 0; --inline-edit-height: 30px; }
.inspector-entity-prefix { color: var(--text-muted); }
</style>

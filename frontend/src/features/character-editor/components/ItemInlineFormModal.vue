<template>
  <AppModal :z-index="4500" @close="$emit('close')">
    <div class="iim-title">{{ entry ? 'Редактировать предмет' : 'Новый предмет' }}</div>

    <FormField label="Название" vertical>
      <FormTextInput v-model:value="name" placeholder="Название..." autofocus @enter="submit" />
    </FormField>

    <FormField label="Описание" vertical>
      <FormTextarea v-model:value="desc" placeholder="Описание..." :rows="4" />
    </FormField>

    <button
      class="iim-toggle"
      :class="{ 'iim-toggle-on': consumable }"
      type="button"
      role="switch"
      :aria-checked="consumable"
      @click="consumable = !consumable"
    >
      <span class="iim-toggle-track"><span class="iim-toggle-thumb"></span></span>
      <span>Расходуемое</span>
    </button>

    <FormActionButtons
      :submit-text="entry ? 'Сохранить' : 'Создать'"
      :can-submit="!!name.trim()"
      @submit="submit"
      @cancel="$emit('close')"
    />
  </AppModal>
</template>

<script setup>
import { ref } from 'vue'
import AppModal from '@/shared/ui/AppModal'
import FormActionButtons from '@/shared/ui/form/FormActionButtons'
import FormField from '@/shared/ui/form/FormField'
import FormTextInput from '@/shared/ui/form/FormTextInput'
import FormTextarea from '@/shared/ui/form/FormTextarea'

const props = defineProps({
  entry: { type: Object, default: null },
  baseItem: { type: Object, default: null },
})
const emit = defineEmits(['close', 'save'])

const ov = props.entry?.override || {}
const fallback = props.baseItem?.data || {}
const name = ref(ov.name ?? props.baseItem?.name ?? '')
const desc = ref(ov.desc ?? fallback.desc ?? '')
const consumable = ref(!!(ov.consumable ?? fallback.consumable ?? false))

function submit() {
  const trimmed = name.value.trim()
  if (!trimmed) return
  emit('save', {
    name: trimmed,
    desc: desc.value,
    consumable: consumable.value,
  })
}
</script>

<style scoped>
.iim-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 14px;
}

.iim-toggle {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 6px 0 14px;
  padding: 0;
  background: none;
  border: none;
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.iim-toggle-track {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  background: var(--surface-raised);
  border-radius: 999px;
  transition: background 0.18s;
}

.iim-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: var(--text-2);
  border-radius: 50%;
  transition: transform 0.18s, background 0.18s;
}

.iim-toggle-on .iim-toggle-track { background: color-mix(in srgb, var(--accent) 60%, var(--surface-raised)); }
.iim-toggle-on .iim-toggle-thumb { transform: translateX(16px); background: var(--text-on-accent); }
</style>

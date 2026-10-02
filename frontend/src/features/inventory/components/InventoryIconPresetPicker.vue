<template>
  <FormField label="Иконка" vertical>
    <LoadingState v-if="store.loading" compact label="Загружаем иконки…" />
    <p v-else-if="store.error" role="alert">{{ store.error }} <ActionButton variant="quiet" @click="store.ensureLoaded()">Повторить</ActionButton></p>
    <div class="inventory-icon-options" role="group" aria-label="Иконка предмета">
      <ActionButton variant="quiet" class="inventory-icon-option" :class="{ 'inventory-icon-option--selected': !modelValue }"
        :aria-pressed="!modelValue" @click="$emit('update:modelValue', null)">
        <ItemIcon :item="{ iconImageUrl: defaultImageUrl }" :size="48" :fallback-to-type="false" />
        <span>По умолчанию</span>
      </ActionButton>
      <ActionButton v-for="preset in options" :key="preset.id" variant="quiet" class="inventory-icon-option"
        :class="{ 'inventory-icon-option--selected': modelValue === preset.id }" :aria-pressed="modelValue === preset.id"
        @click="$emit('update:modelValue', preset.id)">
        <img :src="preset.imageUrl" alt="" width="48" height="48" />
        <span>{{ preset.name }}</span>
      </ActionButton>
    </div>
  </FormField>
</template>
<script setup>
import { computed, onMounted } from 'vue'
import { ActionButton, FormField, LoadingState } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { useInventoryIconPresetsStore } from '@/stores/inventoryIconPresets'
const props = defineProps({ modelValue: { type: Number, default: null }, typeIds: { type: Array, default: () => [2] }, defaultImageUrl: String })
defineEmits(['update:modelValue'])
const store = useInventoryIconPresetsStore()
const options = computed(() => store.forTypes(props.typeIds))
onMounted(() => store.ensureLoaded())
</script>
<style scoped>
.inventory-icon-options { display: grid; grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); gap: 6px; }
.inventory-icon-option { flex-direction: column; gap: 4px; min-height: 90px; padding: 8px 4px; }
.inventory-icon-option img { object-fit: contain; }
.inventory-icon-option span { font-size: 11px; white-space: normal; text-align: center; }
.inventory-icon-option--selected { background: var(--accent-soft); outline: 2px solid var(--accent); outline-offset: -2px; }
</style>

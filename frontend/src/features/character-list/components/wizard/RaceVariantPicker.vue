<template>
  <section class="race-variant-picker" aria-label="Вариант расы">
    <div class="sheet-section-title">{{ sizeOnly ? 'Размер персонажа' : 'Происхождение' }}</div>
    <div class="variant-grid">
      <BaseTile v-for="option in options" :key="option.value" class="variant-card" :framed="modelValue === option.value">
        <ContentRow :title="option.label" :selected="modelValue === option.value" interactive :show-chevron="false"
          :aria-pressed="modelValue === option.value" @activate="$emit('update:modelValue', option.value)">
          <template #icon>
            <span v-if="damageType(option)?.svg" class="variant-damage-icon" role="img" :aria-label="`Тип урона: ${damageType(option).value}`" :title="damageType(option).value">
              <SvgIcon :svg="damageType(option).svg" :color="damageType(option).color" :size="24" />
            </span>
            <Check v-else-if="modelValue === option.value" :size="24" /><component :is="sizeOnly ? Ruler : GitBranch" v-else :size="24" />
          </template>
          <template #subtitle><span class="variant-prompt">{{ modelValue === option.value ? 'Выбрано' : 'Выбрать' }}</span></template>
        </ContentRow>
        <ul v-if="option.benefits?.length" class="variant-benefits">
          <li v-for="benefit in option.benefits" :key="benefit.text">{{ benefit.text }}</li>
        </ul>
        <p v-else-if="option.desc" class="variant-note">{{ option.desc }}</p>
        <p v-if="option.size_description" class="variant-size"><Ruler :size="14" aria-hidden="true" />{{ option.size_description }}</p>
        <details v-if="option.description" class="variant-details">
          <summary>Подробные правила</summary>
          <RichContent :html="option.description" />
        </details>
      </BaseTile>
    </div>
    <p v-if="sizeOnly && sizeDescription && !options.some(option => option.size_description)" class="variant-note">{{ sizeDescription }}</p>
  </section>
</template>
<script setup>
import { computed, watch } from 'vue'
import { BaseTile, ContentRow } from '@sylvieshare/share-ui'
import { Check, GitBranch, Ruler } from '@lucide/vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
import SvgIcon from '@/shared/ui/SvgIcon.vue'
import { useSuggestStore } from '@/stores/suggest'
const props = defineProps({ options: { type: Array, default: () => [] }, modelValue: { type: String, default: null }, sizeDescription: { type: String, default: '' } })
defineEmits(['update:modelValue'])
const sizeOnly = computed(() => props.options.length && props.options.every(option => option.label === option.size))
const suggests = useSuggestStore()
const damageTypes = computed(() => new Map(suggests.items(12).map(type => [Number(type.id), type])))
function damageType(option) { return damageTypes.value.get(Number(option.damage_type)) }
watch(() => props.options.some(option => option.damage_type), needed => {
  if (needed) suggests.ensure(12)
}, { immediate: true })
</script>
<style scoped>
.race-variant-picker { display: flex; flex-direction: column; gap: 12px; }
.variant-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 12px; }
.variant-card { padding: 8px 14px 14px; min-width: 0; }
.variant-card :deep(.oli) { border-radius: var(--r-md); }
.variant-card :deep(.oli:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
.variant-card :deep(.oli-icon) { width: 36px; flex-basis: 36px; color: var(--accent); }
.variant-card :deep(.oli-name) { white-space: normal; }
.variant-prompt { color: var(--accent); font-size: 11px; }
.variant-benefits { padding-left: 20px; margin: 6px 0 12px; color: var(--text-2); font-size: 13px; line-height: 1.55; }
.variant-benefits li + li { margin-top: 5px; }
.variant-note, .variant-size { color: var(--text-muted); font-size: 12px; line-height: 1.5; margin: 8px 0 0; }
.variant-size { display: flex; gap: 7px; align-items: baseline; }
.variant-size svg { flex: none; }
.variant-details { margin-top: 12px; font-size: 13px; line-height: 1.6; }
.variant-details summary { cursor: pointer; color: var(--accent); font-size: 12px; }
.variant-details :deep(p) { margin: 10px 0 0; }
</style>

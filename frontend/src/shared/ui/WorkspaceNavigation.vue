<template>
  <IconNavigation :items="items" :model-value="modelValue" pill :layout="presentation"
    :size="format === 'phone' ? layoutTokens['workspace-navigation-compact'] : layoutTokens['workspace-navigation-item']"
    :height="layoutTokens[format === 'desktop' ? 'workspace-navigation-desktop-height' : 'workspace-navigation-height']"
    :icon-size="layoutTokens[format === 'desktop' ? 'workspace-navigation-desktop-icon' : 'workspace-navigation-icon']"
    :label-size="format === 'desktop' ? 'var(--type-header-size)' : format === 'tablet' ? 'var(--type-workspace-navigation-caption-size)' : null"
    :content-sized="format === 'tablet'" :style="{ '--icon-navigation-label-line-height': format === 'tablet' ? 'var(--type-workspace-navigation-caption-line-height)' : undefined }"
    :selected-size="layoutTokens['workspace-navigation-selected']" :selection="selection" :animate="animate" :label="label" radius="var(--radius-input)" :data-workspace-navigation="format"
    @select="emit('select',$event)" @update:model-value="emit('update:modelValue',$event)">
    <template #icon="{ item }"><slot name="icon" :item="item"><span v-if="item.svg" class="workspace-navigation-icon" :style="{ maskImage:`url(${item.svg})`, WebkitMaskImage:`url(${item.svg})` }" aria-hidden="true" /><component v-else-if="item.icon" :is="item.icon" aria-hidden="true" /></slot></template>
    <template #decoration="{ item }"><slot name="decoration" :item="item" /></template>
  </IconNavigation>
</template>
<script setup>
import { computed } from 'vue'
import { IconNavigation } from '@sylvieshare/share-ui'
import { layoutTokens } from '@/app/design-tokens'
import { useAppLayout } from '@/shared/composables/useAppLayout'
const props = defineProps({ items: {type:Array,default:()=>[]}, modelValue:[String,Number], label:{type:String,required:true}, format:String, selection:Array, animate:{type:Boolean,default:true} })
const emit = defineEmits(['select','update:modelValue'])
const { format: windowFormat } = useAppLayout()
const format = computed(() => props.format || windowFormat.value)
const presentation = computed(() => ({phone:'compact',tablet:'stacked',desktop:'inline'})[format.value])
</script>
<style scoped>
.workspace-navigation-icon { display:block;width:100%;height:100%;background:currentColor;mask-size:contain;mask-position:center;mask-repeat:no-repeat; }
</style>

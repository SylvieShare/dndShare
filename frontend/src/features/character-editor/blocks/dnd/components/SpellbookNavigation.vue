<template>
  <div class="spellbook-navigation">
    <SlidingTabs class="spellbook-tabs" variant="plain" :tabs="navigationTabs" :model-value="modelValue" :max-tab-width="220"
      aria-label="Источники магии" data-sheet-horizontal-scroll @update:model-value="$emit('update:modelValue', $event)">
      <template #decoration="{ active }"><span class="spellbook-paper" :class="{ 'spellbook-paper--active': active }" aria-hidden="true" /></template>
      <template #icon><BookOpen :size="17" aria-hidden="true" /></template>
    </SlidingTabs>
    <ActionButton v-if="editable" class="spellbook-add" variant="dashed" icon-only aria-label="Добавить вкладку магии" title="Добавить вкладку магии" @click="$emit('add')">
      <template #icon><Plus :size="18" aria-hidden="true" /></template>
    </ActionButton>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { ActionButton, SlidingTabs } from '@sylvieshare/share-ui'
import { BookOpen, Plus } from '@lucide/vue'
const props=defineProps({ tabs:{type:Array,default:()=>[]}, modelValue:String, editable:Boolean, panelId:String })
defineEmits(['update:modelValue','add'])
const navigationTabs=computed(()=>props.tabs.map(tab=>({key:tab.key,title:tab.label,id:`${props.panelId}-${tab.key}`,panelId:props.panelId})))
</script>
<style scoped>
.spellbook-navigation {display:flex;align-items:center;gap:var(--spacing-small);min-width:0;margin-bottom:var(--spacing-medium)}
.spellbook-tabs {flex:1;min-width:0;--sliding-tabs-gap:var(--spacing-small)}
.spellbook-add {flex:none;--action-button-icon-size:44px}
.spellbook-paper {position:absolute;inset:0;z-index:-1;pointer-events:none;isolation:isolate;--book-fill:var(--surface);--book-texture:url('@/assets/ui/status-parchment.webp')}
.spellbook-paper::before,.spellbook-paper::after {content:'';position:absolute;inset:0;pointer-events:none}
.spellbook-paper::before {background:var(--book-fill);-webkit-mask:var(--book-texture) center/100% 100% no-repeat;mask:var(--book-texture) center/100% 100% no-repeat;transition:background-color var(--motion-feedback)}
.spellbook-paper::after {background:var(--book-texture) center/100% 100% no-repeat;mix-blend-mode:luminosity;opacity:.35}
.spellbook-paper--active {--book-fill:color-mix(in srgb,var(--accent) 46%,var(--surface))}
@media(prefers-reduced-motion:reduce){.spellbook-paper::before{transition:none}}
</style>

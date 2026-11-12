<template>
  <WorkspaceNavigation :items="items" :model-value="tabs?.[activeTab]?.id ?? activeTab" :format="format" :selection="selection" :animate="animate"
    :label="format === 'phone' ? 'Вкладки персонажа' : 'Раздел персонажа'" :data-sheet-navigation="format"
    data-tutorial="character-tabs" @select="emit('select',$event)" />
</template>
<script setup>
import { computed } from 'vue'
import WorkspaceNavigation from '@/shared/ui/WorkspaceNavigation.vue'
const props=defineProps({tabs:Array,activeTab:Number,format:{type:String,default:'tablet'},selection:Array,animate:{type:Boolean,default:true}})
const emit=defineEmits(['select'])
const items=computed(()=>(props.tabs || []).map((tab,index)=>({key:tab.id ?? index,label:tab.title,svg:tab.svg})))
</script>

<template>
  <RedCreateCharacterWorkspace v-if="isRed" ref="workspace" v-bind="$attrs" :embedded="embedded" :creating="creating" :error="error" :source-version-id="sourceVersionId" @create="emit('create',$event)" @cancel="emit('cancel')" />
  <DndCreateCharacterWorkspace v-else ref="workspace" v-bind="$attrs" :embedded="embedded" :creating="creating" :error="error" @create="emit('create',$event)" @cancel="emit('cancel')" />
</template>
<script setup>
import {computed,ref} from 'vue'
import {useRoute} from 'vue-router'
import {useGameContextStore} from '@/stores/gameContext'
import DndCreateCharacterWorkspace from './DndCreateCharacterWorkspace.vue'
import RedCreateCharacterWorkspace from './RedCreateCharacterWorkspace.vue'
defineOptions({inheritAttrs:false})
const props=defineProps({embedded:Boolean,creating:Boolean,error:String,sourceVersionId:Number,sourceName:String})
const emit=defineEmits(['create','cancel'])
const route=useRoute(),context=useGameContextStore(),workspace=ref(null)
const isRed=computed(()=>props.sourceName==='Cyberpunk'||route.query.system==='cyberpunk-red'||(!props.sourceName&&context.context?.sourceName==='Cyberpunk'))
defineExpose({clearDraft:()=>workspace.value?.clearDraft?.()})
</script>

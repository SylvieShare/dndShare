<template>
  <component :is="component" ref="workspace" v-bind="$attrs" :embedded="embedded" :creating="creating"
    :error="error" :source-version-id="sourceVersionId" @create="emit('create', $event)" @cancel="emit('cancel')" />
</template>
<script setup>
import {computed,ref} from 'vue'
import {useRoute} from 'vue-router'
import {useGameContextStore} from '@/stores/gameContext'
import { creationWorkspace } from '../creationSystems'
defineOptions({inheritAttrs:false})
const props=defineProps({embedded:Boolean,creating:Boolean,error:String,sourceVersionId:Number,sourceName:String})
const emit=defineEmits(['create','cancel'])
const route=useRoute(),context=useGameContextStore(),workspace=ref(null)
const component = computed(() => creationWorkspace(
  props.sourceName ? undefined : route.query.system,
  props.sourceName || context.context?.sourceName,
))
defineExpose({clearDraft:()=>workspace.value?.clearDraft?.()})
</script>

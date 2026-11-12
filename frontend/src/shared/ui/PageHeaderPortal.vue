<template>
  <slot v-if="local || !route" />
  <Teleport v-else-if="active" defer :to="target === 'actions' ? '#app-header-actions' : '#app-subheader'"><slot /></Teleport>
</template>
<script setup>
defineOptions({inheritAttrs:false})
import { computed, inject } from 'vue'
import { routeLocationKey } from 'vue-router'
defineProps({ target:{type:String,default:'navigation'}, local:Boolean })
const route=inject(routeLocationKey,null), owner=route?.path
const active=computed(()=>route?.path===owner)
</script>

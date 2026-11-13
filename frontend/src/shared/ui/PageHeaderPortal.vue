<template>
  <slot v-if="local || !route" />
  <Teleport v-else-if="active" defer to="#app-header-actions"><slot /></Teleport>
</template>
<script setup>
defineOptions({inheritAttrs:false})
import { computed, inject } from 'vue'
import { routeLocationKey } from 'vue-router'
defineProps({ local:Boolean })
const route=inject(routeLocationKey,null), owner=route?.path
const active=computed(()=>route?.path===owner)
</script>

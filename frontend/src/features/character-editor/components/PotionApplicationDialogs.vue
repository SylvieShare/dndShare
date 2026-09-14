<template>
  <AppModalFrame v-if="app.choice" :title="app.choice.name" :z-index="3700" @close="controller.select(null)">
    <div class="potion-choices">
      <ActionButton v-for="choice in app.choice.choices" :key="choice.key" @click="controller.select(choice.key)">{{ choice.name }}</ActionButton>
    </div>
  </AppModalFrame>
  <AppModalFrame v-if="app.result" :title="`Применено: ${app.name}`" :z-index="3700" @close="app.result = null">
    <ApplicationSummary :data="app.result" result />
  </AppModalFrame>
  <AppModalFrame v-if="app.error" title="Не удалось подтвердить применение" :z-index="3700" @close="app.error = ''"><p role="alert">{{ app.error }}</p></AppModalFrame>
</template>
<script setup>
import { computed } from 'vue'
import { ActionButton, AppModalFrame } from '@sylvieshare/share-ui'
import ApplicationSummary from './ApplicationSummary.vue'
const props = defineProps({ controller: { type: Object, required: true } })
const app = computed(() => props.controller.application)
</script>
<style scoped>.potion-choices { display: grid; gap: 10px; }</style>

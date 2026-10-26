<template>
  <CharacterSessionControl :session="ctx.topSession" :controller="ctx.itemTransfers" />
</template>
<script setup>
import { inject } from 'vue'
import CharacterSessionControl from '@/features/character-editor/components/CharacterSessionControl.vue'
defineProps(['block'])
const ctx = inject('charCtx', {})
</script>

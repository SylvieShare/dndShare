<template>
  <ActionButton v-if="tutorial" variant="quiet" @click="restart">Пройти обучение снова</ActionButton>
</template>
<script setup>
import { inject } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import { pageTutorialKey } from '../composables/usePageTutorial'
const emit = defineEmits(['restart'])
const tutorial = inject(pageTutorialKey, null)
function restart() { emit('restart'); tutorial?.restart() }
</script>

<template>
  <div class="rps-choices" role="group" aria-label="Выберите ход">
    <ActionButton v-for="choice in RPS_CHOICES" :key="choice.value" variant="secondary" :disabled="disabled" :aria-label="choice.label" @click="$emit('choose', choice.value)">
      <span class="rps-choice"><RpsChoiceIcon :choice="choice.value" /><span>{{ choice.label }}</span></span>
    </ActionButton>
  </div>
</template>
<script setup>
import { ActionButton } from '@sylvieshare/share-ui'
import RpsChoiceIcon from '@/features/sessions/components/RpsChoiceIcon.vue'
import { RPS_CHOICES } from '@/features/sessions/lib/sessionInteractions'
defineProps({ disabled: Boolean })
defineEmits(['choose'])
</script>
<style scoped>
.rps-choices { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.rps-choices > button { padding: 18px 6px; min-width: 0; }
.rps-choice { display: flex; flex-direction: column; align-items: center; gap: 14px; font-size: 12px; }
@media (max-width: 400px) { .rps-choices { gap: 6px; } .rps-choice > svg { width: 52px; height: 52px; } }
</style>

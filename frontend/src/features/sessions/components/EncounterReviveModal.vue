<template>
  <AppModalFrame :title="`Воскресить: ${name}`" @close="$emit('close')">
    <p class="revive-hint">Укажите количество HP после воскрешения.</p>
    <FormField label="HP после воскрешения" vertical>
      <FormNumberInput
        :value="hp"
        :min="1"
        :max="hpLimit"
        @change="setHp"
      />
    </FormField>
    <p v-if="error" class="revive-error" role="alert">{{ error }}</p>
    <template #footer>
      <FormActionButtons
        submit-text="Воскресить"
        loading-text="Воскрешение…"
        :loading="saving"
        :can-submit="hp >= 1"
        @cancel="$emit('close')"
        @submit="$emit('confirm', hp)"
      />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, ref } from 'vue'
import { AppModalFrame, FormActionButtons, FormField, FormNumberInput } from '@sylvieshare/share-ui'

const props = defineProps({
  name: { type: String, required: true },
  maxHp: { type: Number, default: 0 },
  saving: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
defineEmits(['close', 'confirm'])

const hp = ref(1)
const hpLimit = computed(() => Math.max(1, Number(props.maxHp) || 9999))

function setHp(value) {
  hp.value = Math.min(hpLimit.value, Math.max(1, Math.floor(Number(value) || 1)))
}
</script>

<style scoped>
.revive-hint { margin: 0 0 14px; color: var(--text-2); font-size: 12px; }
.revive-error { margin: 10px 0 0; color: var(--danger); font-size: 11px; }
</style>

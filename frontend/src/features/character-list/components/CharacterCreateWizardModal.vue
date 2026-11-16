<template>
  <AppModal fullscreen :dismissible="!creating" @close="requestClose">
    <CharacterCreateWizardWorkspace
      ref="wizardRef"
      embedded
      :creating="creating"
      :error="error"
      :source-name="sourceName"
      :source-version-id="sourceVersionId"
      @cancel="requestClose"
      @create="emit('create', $event)"
    />
  </AppModal>
</template>

<script setup>
import { ref } from 'vue'
import CharacterCreateWizardWorkspace from '@/features/character-list/pages/ViewCreateCharacter.vue'
import { AppModal } from '@sylvieshare/share-ui'

const props = defineProps({
  sourceName:String,
  sourceVersionId:Number,
  creating: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['close', 'create'])
const wizardRef = ref(null)

function requestClose() {
  if (!props.creating) emit('close')
}

function clearDraft() {
  wizardRef.value?.clearDraft()
}

defineExpose({ clearDraft })
</script>

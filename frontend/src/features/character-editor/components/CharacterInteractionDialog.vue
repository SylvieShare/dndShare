<template>
  <template v-if="controller.state.peer">
    <CharacterRpsDialog v-if="controller.state.mode === 'rps'" :key="controller.state.peer.charUuid" :controller="controller" :character-uuid="characterUuid" />
    <CharacterChatDialog v-else :key="controller.state.peer.charUuid" :controller="controller" :character-uuid="characterUuid" />
  </template>
</template>
<script setup>
import CharacterChatDialog from './CharacterChatDialog.vue'
import CharacterRpsDialog from './CharacterRpsDialog.vue'
defineProps({ controller: { type: Object, required: true }, characterUuid: { type: String, required: true } })
</script>

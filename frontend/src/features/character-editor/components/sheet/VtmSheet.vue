<template>
  <VtmDesktopBase v-if="format === 'desktop' && section === 'base'" />
  <div v-else-if="section === 'personality' || section === 'journal'" class="sheet-stack">
    <CharacterBlock :block-id="section === 'personality' ? 'clan_weakness' : 'notes'" />
  </div>
  <VtmCompactBody v-else :section="section" />
</template>
<script setup>
import CharacterBlock from '../CharacterBlock.vue'
import VtmDesktopBase from './VtmDesktopBase.vue'
import VtmCompactBody from './VtmCompactBody.vue'
defineProps({ section: String, format: String })
</script>

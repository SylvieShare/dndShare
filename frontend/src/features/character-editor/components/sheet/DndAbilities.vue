<template>
  <div class="sheet-stack" style="gap: 20px">
    <template v-if="format !== 'desktop'">
      <CharacterBlock block-id="feature_widgets" />
      <CharacterBlock block-id="actions" />
      <CharacterBlock block-id="resources" />
      <CharacterBlock block-id="defenses" />
      <CharacterBlock block-id="proficiencies" />
    </template>
    <CharacterBlock v-for="id in features" :key="id" :block-id="id" :content-options="{ expanded: true }" />
  </div>
</template>
<script setup>
import CharacterBlock from '../CharacterBlock.vue'
defineProps({ format: String })
const features = ['abilities_class', 'abilities_race', 'abilities_story', 'abilities_feats']
</script>

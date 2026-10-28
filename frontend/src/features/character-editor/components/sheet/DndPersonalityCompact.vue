<template>
  <div class="sheet-stack" style="gap: 17px">
    <BaseTile :outlined="false" class="sheet-stack" style="padding: 14px; gap: 17px">
      <SectionLabel title="Основное" border />
      <div class="sheet-stack" style="gap: 14px">
        <CharacterBlock block-id="person_origin" />
        <CharacterBlock block-id="person_alignment" />
      </div>
      <CharacterBlock block-id="person_appearance" />
    </BaseTile>
    <BaseTile :outlined="false" class="sheet-stack" style="padding: 14px; gap: 17px">
      <SectionLabel title="Облик" border />
      <div class="sheet-grid" style="gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr))">
        <CharacterBlock block-id="person_height" />
        <CharacterBlock block-id="person_weight" />
        <CharacterBlock block-id="person_age" />
        <CharacterBlock block-id="person_eyes" />
        <CharacterBlock block-id="person_skin" />
        <CharacterBlock block-id="person_hair" />
      </div>
    </BaseTile>
    <BaseTile :outlined="false" class="sheet-stack" style="padding: 14px; gap: 20px">
      <SectionLabel title="Характер" border />
      <CharacterBlock block-id="person_traits" />
      <CharacterBlock block-id="person_ideals" />
      <CharacterBlock block-id="person_bonds" />
      <CharacterBlock block-id="person_flaws" />
    </BaseTile>
    <BaseTile :outlined="false" class="sheet-stack" style="padding: 14px; gap: 20px">
      <SectionLabel title="История" border />
      <CharacterBlock block-id="person_backstory" />
      <CharacterBlock block-id="person_allies" />
    </BaseTile>
  </div>
</template>
<script setup>
import { BaseTile, SectionLabel } from '@sylvieshare/share-ui'
import CharacterBlock from '../CharacterBlock.vue'
</script>

<style scoped>
@container character-sheet (min-width: 617px) {
  .dnd-personality-compact.sheet-stack { display: block; columns: 300px 2; column-gap: 17px; }
  .dnd-personality-compact.sheet-stack > :deep(*) { break-inside: avoid; margin-bottom: 17px; }
}
</style>

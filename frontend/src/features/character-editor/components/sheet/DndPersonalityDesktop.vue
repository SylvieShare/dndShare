<template>
  <div class="sheet-stack" style="gap: 0">
    <div class="sheet-stack" style="gap: 22px">
      <BaseTile :outlined="false" class="sheet-stack" style="padding: 18px; gap: 17px">
        <div class="sheet-row" style="gap: 22px">
          <CharacterBlock block-id="person_origin" :options="{&quot;grow&quot;:1,&quot;basis&quot;:0}" />
          <CharacterBlock block-id="person_alignment" :options="{&quot;grow&quot;:1,&quot;basis&quot;:0}" />
        </div>
      </BaseTile>
      <BaseTile :outlined="false" class="sheet-stack" style="padding: 18px; gap: 17px">
        <div class="sheet-row" style="align-items: stretch; gap: 25px">
          <CharacterBlock block-id="ava" :options="{&quot;width&quot;:&quot;200px&quot;,&quot;height&quot;:&quot;260px&quot;}" />
          <div class="sheet-stack" style="flex-grow: 1; flex-basis: 0; gap: 17px">
            <CharacterBlock block-id="person_appearance" />
            <div class="sheet-grid" style="gap: 14px; grid-template-columns: repeat(3, minmax(0, 1fr))">
              <CharacterBlock block-id="person_height" />
              <CharacterBlock block-id="person_weight" />
              <CharacterBlock block-id="person_age" />
              <CharacterBlock block-id="person_eyes" />
              <CharacterBlock block-id="person_skin" />
              <CharacterBlock block-id="person_hair" />
            </div>
          </div>
        </div>
      </BaseTile>
      <BaseTile :outlined="false" class="sheet-stack" style="padding: 18px; gap: 17px">
        <div class="sheet-grid" style="gap: 20px; grid-template-columns: repeat(2, minmax(0, 1fr))">
          <CharacterBlock block-id="person_traits" />
          <CharacterBlock block-id="person_ideals" />
          <CharacterBlock block-id="person_bonds" />
          <CharacterBlock block-id="person_flaws" />
        </div>
      </BaseTile>
      <BaseTile :outlined="false" class="sheet-stack" style="padding: 18px; gap: 20px">
        <CharacterBlock block-id="person_backstory" />
        <CharacterBlock block-id="person_allies" />
      </BaseTile>
    </div>
  </div>
</template>
<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
import CharacterBlock from '../CharacterBlock.vue'
</script>

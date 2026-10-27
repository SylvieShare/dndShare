<template>
  <div class="vtm-desktop-base" style="gap: 21px">
    <div class="sheet-stack" style="gap: 21px">
      <CharacterBlock block-id="char_name" />
      <CharacterBlock block-id="ava" />
      <div class="sheet-stack" style="gap: 11px">
        <CharacterBlock block-id="clan" />
        <CharacterBlock block-id="nature" />
        <CharacterBlock block-id="mask" />
        <CharacterBlock block-id="persona" />
        <CharacterBlock block-id="sire" />
      </div>
      <div class="sheet-stack" style="gap: 6px">
        <SectionLabel title="ЗДОРОВЬЕ" border />
        <CharacterBlock block-id="health" />
      </div>
      <SectionLabel title="ОПЫТ" border />
      <div class="sheet-row" style="gap: 14px">
        <CharacterBlock block-id="xp_total" />
        <CharacterBlock block-id="xp_spent" />
      </div>
    </div>
    <div class="sheet-stack" style="gap: 21px">
      <SectionLabel title="Характеристики" border />
      <div class="sheet-grid" style="gap: 42px; grid-template-columns: repeat(3, minmax(0, 1fr))">
        <div class="sheet-stack" style="gap: 6px">
          <SectionLabel title="ФИЗИЧЕСКИЕ" border />
          <CharacterBlock block-id="strength" />
          <CharacterBlock block-id="dexterity" />
          <CharacterBlock block-id="stamina" />
        </div>
        <div class="sheet-stack" style="gap: 6px">
          <SectionLabel title="СОЦИАЛЬНЫЕ" border />
          <CharacterBlock block-id="charisma" />
          <CharacterBlock block-id="manipulation" />
          <CharacterBlock block-id="appearance" />
        </div>
        <div class="sheet-stack" style="gap: 6px">
          <SectionLabel title="МЕНТАЛЬНЫЕ" border />
          <CharacterBlock block-id="perception" />
          <CharacterBlock block-id="intelligence" />
          <CharacterBlock block-id="wits" />
        </div>
      </div>
      <SectionLabel title="Способности" border />
      <div class="sheet-grid" style="gap: 42px; grid-template-columns: repeat(3, minmax(0, 1fr))">
        <div class="sheet-stack" style="gap: 6px">
          <SectionLabel title="ТАЛАНТЫ" border />
          <CharacterBlock block-id="athletics" />
          <CharacterBlock block-id="alertness" />
          <CharacterBlock block-id="brawl" />
          <CharacterBlock block-id="intimidation" />
          <CharacterBlock block-id="expression" />
          <CharacterBlock block-id="leadership" />
          <CharacterBlock block-id="streetwise" />
          <CharacterBlock block-id="subterfuge" />
          <CharacterBlock block-id="dodge" />
          <CharacterBlock block-id="empathy" />
        </div>
        <div class="sheet-stack" style="gap: 6px">
          <SectionLabel title="НАВЫКИ" border />
          <CharacterBlock block-id="drive" />
          <CharacterBlock block-id="security" />
          <CharacterBlock block-id="survival" />
          <CharacterBlock block-id="performance" />
          <CharacterBlock block-id="animal_ken" />
          <CharacterBlock block-id="crafts" />
          <CharacterBlock block-id="stealth" />
          <CharacterBlock block-id="firearms" />
          <CharacterBlock block-id="melee" />
          <CharacterBlock block-id="etiquette" />
        </div>
        <div class="sheet-stack" style="gap: 6px">
          <SectionLabel title="ЗНАНИЯ" border />
          <CharacterBlock block-id="linguistics" />
          <CharacterBlock block-id="academics" />
          <CharacterBlock block-id="law" />
          <CharacterBlock block-id="computer" />
          <CharacterBlock block-id="medicine" />
          <CharacterBlock block-id="occult" />
          <CharacterBlock block-id="politics" />
          <CharacterBlock block-id="investigation" />
          <CharacterBlock block-id="finance" />
          <CharacterBlock block-id="electronics" />
        </div>
      </div>
      <SectionLabel title="Преимущества" border />
      <div class="sheet-grid" style="gap: 42px; grid-template-columns: repeat(3, minmax(0, 1fr))">
        <div class="sheet-stack" style="gap: 6px">
          <SectionLabel title="ДИСЦИПЛИНЫ" border />
          <CharacterBlock block-id="disciplines" />
        </div>
        <div class="sheet-stack" style="gap: 6px">
          <SectionLabel title="ПРЕДЫСТОРИИ" border />
          <CharacterBlock block-id="backgrounds" />
        </div>
        <div class="sheet-stack" style="gap: 6px">
          <SectionLabel title="ДОБРОДЕТЕЛИ" border />
          <CharacterBlock block-id="conscience" />
          <CharacterBlock block-id="self_control" />
          <CharacterBlock block-id="courage" />
        </div>
      </div>
      <SectionLabel title="" border />
      <div class="sheet-grid" style="gap: 42px; grid-template-columns: repeat(3, minmax(0, 1fr))">
        <div class="sheet-stack" style="gap: 6px">
          <SectionLabel title="Деньги" border />
          <CharacterBlock block-id="money" />
        </div>
        <div class="sheet-stack" style="gap: 6px">
          <SectionLabel title="ЧЕЛОВЕЧНОСТЬ / ПУТЬ" border />
          <CharacterBlock block-id="humanity" />
          <SectionLabel title="СИЛА ВОЛИ" border />
          <CharacterBlock block-id="willpower_perm" />
          <CharacterBlock block-id="willpower_temp" />
        </div>
        <div class="sheet-stack" style="gap: 6px">
          <SectionLabel title="ЗАПАС КРОВИ" border />
          <CharacterBlock block-id="blood_pool" />
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { SectionLabel } from '@sylvieshare/share-ui'
import CharacterBlock from '../CharacterBlock.vue'
</script>

<style scoped>
.vtm-desktop-base { display: grid; grid-template-columns: var(--layout-sheet-stats-column) minmax(0, 1fr); padding: 20px; }
</style>

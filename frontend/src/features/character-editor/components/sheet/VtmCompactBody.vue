<template>
  <div class="sheet-stack vtm-compact-body">
    <template v-if="section === 'base'">
      <BaseTile :outlined="false" class="sheet-stack vtm-tile">
        <CharacterBlock block-id="char_name" />
        <CharacterBlock block-id="ava" :content-options="{ height: 240 }" />
        <CharacterBlock v-for="id in ['clan', 'nature', 'mask', 'persona', 'sire']" :key="id" :block-id="id" />
      </BaseTile>
      <BaseTile :outlined="false" class="sheet-stack vtm-tile">
        <SectionLabel title="Здоровье" border /><CharacterBlock block-id="health" />
        <SectionLabel title="Запас крови" border /><CharacterBlock block-id="blood_pool" />
        <CharacterBlock block-id="xp_total" /><CharacterBlock block-id="xp_spent" />
      </BaseTile>
    </template>
    <template v-else-if="section === 'stats' || section === 'abilities'">
      <div class="vtm-groups">
        <BaseTile :outlined="false" v-for="group in groups" :key="group.title" class="sheet-stack vtm-tile">
          <SectionLabel :title="group.title" border />
          <CharacterBlock v-for="id in group.fields" :key="id" :block-id="id" />
        </BaseTile>
      </div>
    </template>
    <template v-else-if="section === 'advantages'">
      <BaseTile :outlined="false" class="sheet-stack vtm-tile"><SectionLabel title="Дисциплины" border /><CharacterBlock block-id="disciplines" /></BaseTile>
      <BaseTile :outlined="false" class="sheet-stack vtm-tile"><SectionLabel title="Предыстории" border /><CharacterBlock block-id="backgrounds" /></BaseTile>
      <BaseTile :outlined="false" class="sheet-stack vtm-tile">
        <SectionLabel title="Добродетели" border />
        <CharacterBlock v-for="id in ['conscience', 'self_control', 'courage', 'humanity', 'willpower_perm', 'willpower_temp', 'money']" :key="id" :block-id="id" />
      </BaseTile>
    </template>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { BaseTile, SectionLabel } from '@sylvieshare/share-ui'
import CharacterBlock from '../CharacterBlock.vue'
const props = defineProps({ section: String })
const stats = [
  { title: 'Физические', fields: ['strength', 'dexterity', 'stamina'] },
  { title: 'Социальные', fields: ['charisma', 'manipulation', 'appearance'] },
  { title: 'Ментальные', fields: ['perception', 'intelligence', 'wits'] },
]
const abilities = [
  { title: 'Таланты', fields: ['athletics', 'alertness', 'brawl', 'intimidation', 'expression', 'leadership', 'streetwise', 'subterfuge', 'dodge', 'empathy'] },
  { title: 'Навыки', fields: ['drive', 'security', 'survival', 'performance', 'animal_ken', 'crafts', 'stealth', 'firearms', 'melee', 'etiquette'] },
  { title: 'Знания', fields: ['linguistics', 'academics', 'law', 'computer', 'medicine', 'occult', 'politics', 'investigation', 'finance', 'electronics'] },
]
const groups = computed(() => props.section === 'stats' ? stats : abilities)
</script>
<style scoped>
.vtm-compact-body, .vtm-tile { gap: 16px; }
.vtm-tile { padding: 16px; break-inside: avoid; }
.vtm-groups { columns: var(--layout-sheet-stat-min) 3; column-gap: 16px; }
.vtm-groups > * { margin-bottom: 16px; }
</style>

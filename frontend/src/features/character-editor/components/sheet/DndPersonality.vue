<template>
  <div class="personality" :class="'personality--' + format">
    <BaseTile v-for="group in groups" :key="group.title" :outlined="false" class="person-group">
      <SectionLabel :title="group.title" border />
      <div v-if="group.portrait" class="appearance-head">
        <CharacterBlock block-id="ava" :options="portraitSize" />
        <CharacterBlock v-if="group.description" block-id="person_appearance" />
      </div>
      <CharacterBlock v-else-if="group.description" block-id="person_appearance" />
      <div v-if="group.fields.length" class="person-fields" :class="{ 'person-fields--short':group.short }">
        <CharacterBlock v-for="id in group.fields" :key="id" :block-id="id" />
      </div>
    </BaseTile>
    <p v-if="!groups.length" class="person-empty">Сведения о личности пока не заполнены.</p>
  </div>
</template>
<script setup>
import { computed, inject } from 'vue'
import { BaseTile, SectionLabel } from '@sylvieshare/share-ui'
import CharacterBlock from '../CharacterBlock.vue'
const props = defineProps({ format: String })
const ctx = inject('charCtx', {})
const sections = [
  { title:'Основное', short:true, fields:['person_origin','person_alignment'] },
  { title:'Облик', short:true, appearance:true, fields:['person_height','person_weight','person_age','person_eyes','person_skin','person_hair'] },
  { title:'Характер', fields:['person_traits','person_ideals','person_bonds','person_flaws'] },
  { title:'История', fields:['person_backstory','person_allies'] },
]
function visible(id) {
  if (ctx.ownerMode) return true
  const value = ctx.values?.[id]
  return id === 'ava' ? Boolean(value?.url) : Boolean(String(value ?? '').trim())
}
const groups = computed(() => sections.map(section => ({
  ...section, fields:section.fields.filter(visible), portrait:section.appearance && visible('ava'),
  description:section.appearance && visible('person_appearance'),
})).filter(section => section.fields.length || section.portrait || section.description))
const portraitSize = computed(() => props.format === 'desktop' ? {width:'148px',height:'174px'} : {width:'84px',height:'96px'})
</script>
<style scoped>
.personality {display:grid;gap:var(--spacing-page);min-width:0}
.person-group {display:grid;align-content:start;gap:var(--spacing-medium);padding:var(--spacing-page);min-width:0}
.person-fields {display:grid;gap:var(--spacing-medium);min-width:0}
.person-fields--short {grid-template-columns:repeat(2,minmax(0,1fr))}
.appearance-head {display:flex;align-items:flex-start;gap:var(--spacing-medium);min-width:0}
.appearance-head > :first-child {flex:none}.appearance-head > :nth-child(2) {flex:1;min-width:0}
.person-empty {color:var(--text-muted);margin:var(--spacing-page)}
@media (min-width:700px) { .personality--tablet {grid-template-columns:repeat(2,minmax(0,1fr));align-items:start} }
</style>

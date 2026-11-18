<template>
  <div v-if="combatant?.position === 'combat' && (membershipVisible || (active && current))" class="roster-presence" :aria-label="active ? 'Участвует в бою' : 'Добавлен на сцену'">
    <span v-if="membershipVisible"><Swords :size="14" aria-hidden="true" />{{ active ? 'В бою' : 'На сцене' }}</span>
    <span v-if="active && current" class="roster-current-turn"><ArrowRight :size="14" aria-hidden="true" />Сейчас ход</span>
  </div>
</template>
<script setup>
import { ArrowRight,Swords } from '@lucide/vue'
defineProps({combatant:Object,active:Boolean,current:Boolean,membershipVisible:{type:Boolean,default:true}})
</script>
<style scoped>
.roster-presence {display:flex;flex-wrap:wrap;align-items:center;gap:var(--spacing-small);margin-top:var(--spacing-xs);font-size:var(--type-caption-size);line-height:var(--type-caption-line-height);color:var(--text-muted)}
.roster-presence span {display:inline-flex;align-items:center;gap:var(--spacing-xs)}
.roster-current-turn {color:var(--warning)}
</style>

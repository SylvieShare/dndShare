<template>
  <div class="dnd-heading">
    <button class="portrait" type="button" aria-label="Профиль персонажа" @click="emit('open', 'profile')">
      <img v-if="iconUrl && !failed" :src="iconUrl" alt="" @error="failed = true" /><span v-else>{{ Array.from(name || '?')[0] }}</span>
    </button>
    <div class="identity">
      <h1><button class="name" type="button" @click="emit('open', 'profile')"><strong>{{ name || 'Лист персонажа' }}</strong><small v-if="subtitle">{{ subtitle }}<template v-if="level"> · {{ level }} ур.</template></small></button></h1>
      <CharacterBlock block-id="hp" :options="{ variant: 'heading' }" />
    </div>
    <DndStatusChip v-if="wide" @click="emit('open', 'statuses')" />
  </div>
</template>
<script setup>
import { computed, inject, ref, watch } from 'vue'
import CharacterBlock from '../CharacterBlock.vue'
import DndStatusChip from './DndStatusChip.vue'
const props = defineProps({ name: String, subtitle: String, iconUrl: String, wide: Boolean })
const emit = defineEmits(['open'])
const ctx = inject('charCtx', {})
const level = computed(() => ctx.values?.lvl?.level)
const failed = ref(false)
watch(() => props.iconUrl, () => { failed.value = false })
</script>
<style scoped>
.dnd-heading,.name { display:flex; align-items:center; gap:var(--spacing-label); min-width:0 }
.portrait,.name { cursor:pointer; background:transparent; border:0; color:var(--text-1); padding:0 }
.portrait { flex:none; width:var(--layout-sheet-header-icon); height:var(--layout-sheet-header-icon); color:var(--accent-soft); font-size:var(--type-sheet-header-size) }
.portrait img { width:100%; height:100%; object-fit:cover; border-radius:var(--radius-input) }
.identity { min-width:0 }
.identity h1 { margin:0; font:inherit }
.name { width:100%; text-align:left; align-items:baseline }
.name strong,.name small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.name strong { font-size:var(--type-sheet-header-size) }
.name small { font-size:var(--type-context-size); color:var(--text-muted) }
@media (--ui-compact) { .name { flex-wrap:wrap; gap:0 var(--spacing-xs) } .name small { font-size:var(--type-caption-size, 12px) } }
</style>

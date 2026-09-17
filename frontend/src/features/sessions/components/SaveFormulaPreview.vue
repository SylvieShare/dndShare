<template>
  <div class="save-formula" :aria-label="label">
    <span v-if="profile.mode !== 'normal'">2 ×</span><SystemDie :sides="20" :size="26" color="var(--accent-soft)" />
    <template v-if="profile.bonus"><span>{{ profile.bonus > 0 ? '+' : '−' }}</span><strong>{{ Math.abs(profile.bonus) }}</strong></template>
    <template v-for="(part, index) in extra" :key="index">
      <span>{{ part.sign === '-' ? '−' : '+' }}</span>
      <template v-if="part.kind === 'dice'"><span v-if="part.n !== 1">{{ part.n }} ×</span><SystemDie :sides="part.sides" :size="26" :color="part.color || 'var(--accent-soft)'" /></template>
      <strong v-else>{{ part.value }}</strong>
    </template>
    <small v-if="profile.mode !== 'normal'">{{ profile.mode === 'advantage' ? 'больший d20' : 'меньший d20' }}</small>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import SystemDie from '@/shared/ui/SystemDie.vue'
import { parseDiceExpression } from '@/shared/lib/dice'
const props = defineProps({ profile: { type: Object, required: true } })
const extra = computed(() => parseDiceExpression(props.profile.formula || ''))
const label = computed(() => `Спасбросок: ${props.profile.mode === 'normal' ? 'd20' : props.profile.mode === 'advantage' ? '2d20, больший' : '2d20, меньший'} ${props.profile.bonus >= 0 ? '+' : '−'} ${Math.abs(props.profile.bonus)}${props.profile.formula ? ` + ${props.profile.formula}` : ''}`)
</script>
<style scoped>
.save-formula { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; color: var(--text-2); font-size: 13px; }
.save-formula small { color: var(--text-muted); margin-left: 3px; }
</style>

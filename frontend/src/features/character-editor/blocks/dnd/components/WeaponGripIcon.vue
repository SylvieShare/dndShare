<template>
  <span class="weapon-grip" :class="{ 'weapon-grip--two': hands === 2 }" role="img" :aria-label="label" :title="label">
    <Hand v-if="hands === 2" class="weapon-grip__second" :size="layoutTokens['weapon-grip-icon']" aria-hidden="true" />
    <Hand :size="layoutTokens['weapon-grip-icon']" aria-hidden="true" />
  </span>
</template>
<script setup>
import { computed } from 'vue'
import { Hand } from '@lucide/vue'
import { layoutTokens } from '@/app/design-tokens'
const props = defineProps({ hands: { type: Number, required: true } })
const label = computed(() => props.hands === 2 ? 'Двумя руками' : 'Одной рукой')
</script>
<style scoped>
.weapon-grip {display:inline-flex;align-items:center;padding:1px;border-radius:var(--radius-xs);background:var(--bg);color:var(--text-1);line-height:1;pointer-events:none}
.weapon-grip--two > svg + svg {margin-inline-start:-3px}
.weapon-grip__second {transform:scaleX(-1)}
</style>

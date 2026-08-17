<template>
  <component :is="iconComponent" aria-hidden="true" />
</template>

<script setup>
import { computed } from 'vue'
import {
  BookOpenCheck,
  CircleDotDashed,
  Dices,
  Footprints,
  HeartPulse,
  ScrollText,
  Sparkles,
  Swords,
} from '@lucide/vue'

const props = defineProps({ name: { type: String, default: 'book' } })

const icons = {
  book: BookOpenCheck,
  sheet: ScrollText,
  dice: Dices,
  turn: Footprints,
  attack: Swords,
  health: HeartPulse,
  magic: Sparkles,
  conditions: CircleDotDashed,
}

const iconComponent = computed(() => icons[props.name] || BookOpenCheck)
</script>

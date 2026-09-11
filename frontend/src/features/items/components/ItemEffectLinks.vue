<template>
  <HandbookReferenceRows v-if="rows.length" :rows="rows" :z-index="zIndex" />
</template>
<script setup>
import { computed } from 'vue'
import HandbookReferenceRows from './HandbookReferenceRows.vue'
import { statusEffectLinks } from '@/features/character-editor/lib/characterStatuses'
const props = defineProps({ item: Object, zIndex: { type: Number, default: 5100 } })
const rows = computed(() => statusEffectLinks(props.item).map(link => ({
  id: link.effect_id, key: link.key,
  condition: [link.target === 'other' ? 'На цель' : 'На владельца', link.condition, link.weapon_damage_key && `Связано с уроном: ${(props.item?.data?.weapon_damage || []).find(rule => rule.key === link.weapon_damage_key)?.label || link.weapon_damage_key}`].filter(Boolean).join(' · '),
})))
</script>

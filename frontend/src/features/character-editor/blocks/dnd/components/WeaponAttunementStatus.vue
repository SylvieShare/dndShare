<template>
  <span
    v-if="entry.magic_item_id && needsAttunement(item)"
    class="weapon-attunement"
    :class="{ 'weapon-attunement--active': attuned }"
    :title="item.data?.attunement_requirement || undefined"
  >{{ attuned ? 'Настроено' : 'Не настроено' }}</span>
</template>

<script setup>
import { computed } from 'vue'
import { needsAttunement } from '@/features/character-editor/lib/magicItemSettings'

const props = defineProps({ entry: { type: Object, required: true }, item: Object })
const attuned = computed(() => !!props.entry.params?.magic?.attuned)
</script>

<style scoped>
.weapon-attunement {
  display: block;
  color: var(--warning);
  font-size: 11px;
  font-weight: 600;
}
.weapon-attunement--active { color: var(--success); }
</style>

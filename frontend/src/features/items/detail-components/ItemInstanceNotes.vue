<template>
  <DetailSection v-if="instance.params?.magic_bonus || instance.add_attacks?.length" label="Дополнительно у этого экземпляра">
    <p v-if="instance.params?.magic_bonus">{{ item.typeId === 12 || item.data?.armor_base && !item.data?.weapon ? 'Бонус к КД' : 'Бонус к атаке и урону' }}: +{{ instance.params.magic_bonus }}</p>
    <DamageDice v-if="parts.length" :parts="parts" :size="32" />
  </DetailSection>
  <DetailSection v-if="instance.desc" label="Заметки об экземпляре">
    <RichContent :html="instance.desc" />
  </DetailSection>
</template>
<script setup>
import { computed } from 'vue'
import DetailSection from '@/shared/ui/DetailSection.vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
import DamageDice from '@/features/character-editor/blocks/dnd/components/DamageDice.vue'
import { diceById } from '@/shared/lib/systemDice'
import { useSuggestStore } from '@/stores/suggest'
const props = defineProps({ item: Object, instance: Object })
const suggest = useSuggestStore()
const parts = computed(() => (props.instance.add_attacks || []).map(row => ({
  count: row.count, diceSides: diceById(row.dice_id)?.sides,
  type: suggest.items(12).find(type => type.id === row.type_suggest_id)?.value || '',
})))
</script>

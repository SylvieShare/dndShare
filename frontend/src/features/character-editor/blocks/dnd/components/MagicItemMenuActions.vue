<template>
  <RowActionItem v-if="needsAttunement(item) && !currentEntry.params?.magic?.lost" :icon="attuned ? Unlink : Link" :title="attunementHint" @click="toggleAttunement">
    {{ attuned ? 'Снять настройку' : 'Настроить на персонажа' }}
  </RowActionItem>
  <RowActionItem v-if="missingMagicBases(item, currentEntry).length" action="edit" @click="$emit('configure'); $emit('close')">Выбрать основу</RowActionItem>
  <RowActionItem v-if="hasMagicInstanceOptions(item)" action="edit" @click="$emit('configure'); $emit('close')">Параметры экземпляра</RowActionItem>
</template>
<script setup>
import { computed } from 'vue'
import { Link, Unlink } from '@lucide/vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { inventoryEntries } from '@/features/character-editor/lib/characterMagicItems'
import { hasMagicInstanceOptions, missingMagicBases, needsAttunement, setInstanceAttunement } from '@/features/character-editor/lib/magicItemSettings'
const props = defineProps({ item: Object, entry: Object, values: Object })
const emit = defineEmits(['update:values', 'configure', 'close'])
const currentEntry = computed(() => inventoryEntries(props.values).find(row => row.entry.uid === props.entry.uid)?.entry || props.entry)
const attuned = computed(() => !!currentEntry.value.params?.magic?.attuned)
const attunementHint = computed(() => props.item?.data?.attunement_requirement || (props.item?.data?.attunement === 'unknown' ? 'Уточните требование настройки с мастером.' : 'Отметка настройки этого экземпляра.'))
function toggleAttunement() {
  emit('update:values', setInstanceAttunement(props.values, props.item, props.entry.uid, !attuned.value))
  emit('close')
}
</script>

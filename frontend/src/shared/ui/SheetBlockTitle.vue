<template>
  <MorphTileHeader :title="upper ? title.toUpperCase() : title" :show-edit="showEdit" :edit-fade="editFade" :clickable-title="clickableTitle" edit-label="Редактировать" @edit="$emit('edit', $event)">
    <template v-if="$slots.aside" #aside><slot name="aside" /></template>
  </MorphTileHeader>
</template>
<script setup>
import { MorphTileHeader } from '@sylvieshare/share-ui'
defineProps({ title: { type: String, default: '' }, showEdit: { type: Boolean, default: true }, editFade: Boolean, clickableTitle: { type: Boolean, default: true }, upper: Boolean })
defineEmits(['edit'])
</script>

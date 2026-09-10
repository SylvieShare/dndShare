<template><ObjectListItem :item="item" :type="type" :name-en="item.nameEn || ''" :custom="item.userId != null" :subtitle="subtitle" /></template>
<script setup>
import { computed } from 'vue'
import ObjectListItem from './ObjectListItem.vue'
import { statusDuration, statusPolarity } from '../lib/statusEffectPresentation'
const props = defineProps({ item: Object, type: Object })
const subtitle = computed(() => {
  const data = props.item.data || {}
  return Number(props.type?.id || props.item.typeId) === 15
    ? [statusPolarity(data.polarity).label, statusDuration(data.duration), data.concentration ? 'Концентрация' : ''].filter(Boolean).join(' · ')
    : data.feature || ''
})
</script>

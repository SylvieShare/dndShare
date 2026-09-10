<template>
  <component :is="renderer" :item="item" :type="type" :name-en="item.nameEn || ''" :custom="item.userId != null" />
</template>

<script setup>
import { computed } from 'vue'
import ArmorListItem from './ArmorListItem.vue'
import EnemyListItem from './EnemyListItem.vue'
import FeatListItem from './FeatListItem.vue'
import ItemListItem from './ItemListItem.vue'
import ObjectListItem from './ObjectListItem.vue'
import OriginListItem from './OriginListItem.vue'
import PotionListItem from './PotionListItem.vue'
import SpellListItem from './SpellListItem.vue'
import TransportListItem from './TransportListItem.vue'
import WeaponListItem from './WeaponListItem.vue'
import RuleSummaryListItem from './RuleSummaryListItem.vue'

const props = defineProps({ item: { type: Object, required: true }, type: { type: Object, default: null } })
const renderers = {
  1: WeaponListItem, 2: ItemListItem, 5: SpellListItem, 6: EnemyListItem,
  7: FeatListItem, 8: OriginListItem, 9: OriginListItem, 10: PotionListItem,
  12: ArmorListItem, 13: TransportListItem, 14: ItemListItem,
  11: RuleSummaryListItem, 15: RuleSummaryListItem,
  16: OriginListItem, 17: OriginListItem,
}
const renderer = computed(() => renderers[props.type?.id || props.item.typeId] || ObjectListItem)
</script>

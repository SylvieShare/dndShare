<template>
  <div v-if="source?.data?.confirmed_uses?.length || ctx.item(entry)?.data?.selected_target || entry.params?.magic?.bonus_transfer || entry.params?.magic?.weapon_use?.status === 'active' || resources.length || hasEffects || entry.params?.magic?.last_charge_check" class="weapon-item-mechanics" @click.stop @pointerdown.stop>
    <ItemResourcePips v-for="resource in resources" :key="resource.key" :resource="resource" :label="resource.source?.resourceKey ? resource.title : 'Заряды'" :interactive="!!ctx.charCtx.ownerMode" @toggle="ctx.toggleWeaponResource(resource, $event)" />
    <ConfirmedItemUsePanel v-if="source?.data?.confirmed_uses?.length" :uid="entry.uid" />
    <SelectedTargetPanel :uid="entry.uid" />
    <WeaponBonusTransferPanel v-if="entry.params?.magic?.bonus_transfer" :uid="entry.uid" />
    <WeaponUsePanel v-if="entry.params?.magic?.weapon_use?.status === 'active'" :uid="entry.uid" />
    <ItemLastChargeCheck v-if="entry.params?.magic?.last_charge_check" :uid="entry.uid" />
    <ItemEffectLinks v-if="hasEffects" :item="source" />
  </div>
</template>
<script setup>
import ConfirmedItemUsePanel from './ConfirmedItemUsePanel.vue'
import SelectedTargetPanel from './SelectedTargetPanel.vue'
import WeaponBonusTransferPanel from './WeaponBonusTransferPanel.vue'
import WeaponUsePanel from './WeaponUsePanel.vue'
import ItemLastChargeCheck from './ItemLastChargeCheck.vue'
import ItemResourcePips from './ItemResourcePips.vue'
import { confirmedItemUses } from '@/features/character-editor/lib/confirmedItemUses'
import { computed, inject, unref } from 'vue'
import ItemEffectLinks from '@/features/items/components/ItemEffectLinks.vue'
const props = defineProps({ entry: { type: Object, required: true } })
const ctx = inject('weaponsBlockCtx')
const resources = computed(() => {
  const embedded = confirmedItemUses(unref(ctx.charCtx.values) || {}, unref(ctx.charCtx.characterResources?.itemsById) || new Map(), props.entry.uid).filter(use => use.show_resource).map(use => use.resource?.key)
  return (ctx.weaponResources?.(props.entry) || []).filter(row => !embedded.includes(row.key))
})
const source = computed(() => ctx.itemMap?.[props.entry.magic_item_id] || ctx.item(props.entry))
const hasEffects = computed(() => !props.entry.params?.magic?.lost && !!source.value?.data?.status_effects?.length)
</script>
<style scoped>
.weapon-item-mechanics { display: grid; gap: 10px; padding: 0 20px 14px 16px; cursor: default; }
</style>

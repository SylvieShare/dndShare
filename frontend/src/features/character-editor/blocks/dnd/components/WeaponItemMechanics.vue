<template>
  <div v-if="visible" class="weapon-item-mechanics" @click.stop @pointerdown.stop>
    <WeaponCataloguePanels :panels="cataloguePanels" />
    <WeaponNotePanels :notes="notes" :item="source" />
    <ItemResourcePanel v-for="resource in resources" :key="resource.key" :resource="resource" :label="resource.source?.resourceKey ? resource.title : 'Заряды'" :interactive="!!ctx.charCtx.ownerMode" @toggle="ctx.toggleWeaponResource(resource, $event)" />
    <ConfirmedItemUsePanel v-if="source?.data?.confirmed_uses?.length" :uid="entry.uid" />
    <SelectedTargetPanel :uid="entry.uid" />
    <WeaponBonusTransferPanel v-if="entry.params?.magic?.bonus_transfer" :uid="entry.uid" />
    <WeaponUsePanel v-if="entry.params?.magic?.weapon_use?.status === 'active'" :uid="entry.uid" />
    <ItemLastChargeCheck v-if="entry.params?.magic?.last_charge_check" :uid="entry.uid" />
    <ItemMechanicPanel v-if="hasEffects" kind="effect" title="Эффекты оружия"><ItemEffectLinks :item="source" /></ItemMechanicPanel>
  </div>
</template>
<script setup>
import ConfirmedItemUsePanel from './ConfirmedItemUsePanel.vue'
import SelectedTargetPanel from './SelectedTargetPanel.vue'
import WeaponBonusTransferPanel from './WeaponBonusTransferPanel.vue'
import WeaponUsePanel from './WeaponUsePanel.vue'
import ItemLastChargeCheck from './ItemLastChargeCheck.vue'
import ItemResourcePanel from './ItemResourcePanel.vue'
import WeaponCataloguePanels from './WeaponCataloguePanels.vue'
import { confirmedItemUses } from '@/features/character-editor/lib/confirmedItemUses'
import { computed, inject, provide, unref } from 'vue'
import ItemEffectLinks from '@/features/items/components/ItemEffectLinks.vue'
import ItemMechanicPanel from '@/features/items/components/ItemMechanicPanel.vue'
import WeaponNotePanels from '@/features/items/components/WeaponNotePanels.vue'
import { visibleWeaponNotes } from '@/features/character-editor/lib/weaponNotes'
import { weaponCataloguePanels } from '@/features/character-editor/lib/weaponCataloguePanels'
const props = defineProps({ entry: { type: Object, required: true } })
const ctx = inject('weaponsBlockCtx')
provide('weaponMechanicCollapse', true)
const resources = computed(() => {
  const embedded = confirmedItemUses(unref(ctx.charCtx.values) || {}, unref(ctx.charCtx.characterResources?.itemsById) || new Map(), props.entry.uid).filter(use => use.show_resource).map(use => use.resource?.key)
  return (ctx.weaponResources?.(props.entry) || []).filter(row => !embedded.includes(row.key))
})
const source = computed(() => ctx.itemMap?.[props.entry.magic_item_id] || ctx.item(props.entry))
const base = computed(() => ctx.itemMap?.[props.entry.item_id] || (Number(source.value?.typeId) === 1 ? source.value : null))
const cataloguePanels = computed(() => weaponCataloguePanels(source.value, props.entry, base.value, unref(ctx.charCtx.values), ctx.propertyItems?.(props.entry) || []))
const hasEffects = computed(() => !props.entry.params?.magic?.lost && !!source.value?.data?.status_effects?.length)
const notes = computed(() => visibleWeaponNotes(source.value, props.entry, true, unref(ctx.charCtx.values)))
const visible = computed(() => cataloguePanels.value.length || notes.value.length || source.value?.data?.confirmed_uses?.length || source.value?.data?.selected_target
  || props.entry.params?.magic?.bonus_transfer || props.entry.params?.magic?.weapon_use?.status === 'active'
  || resources.value.length || hasEffects.value || props.entry.params?.magic?.last_charge_check)
</script>
<style scoped>
.weapon-item-mechanics { display: grid; gap: 10px; padding: 0 20px 14px 16px; cursor: default; }
</style>

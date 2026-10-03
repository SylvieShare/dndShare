<template>
  <div v-if="visible" class="weapon-item-mechanics" @click.stop @pointerdown.stop>
    <WeaponNotePanels :notes="notes" :item="source" :resources="bindings.notes" :interactive="canManage" @toggle="toggle" />
    <ConfirmedItemUsePanel v-if="confirmed.length" :uid="entry.uid" :resources="bindings.confirmed" />
    <SelectedTargetPanel :uid="entry.uid" />
    <WeaponBonusTransferPanel v-if="entry.params?.magic?.bonus_transfer" :uid="entry.uid" />
    <WeaponUsePanel v-if="hasUses" :uid="entry.uid" :item="source" :resources="bindings.uses" @toggle="toggle" />
    <ItemLastChargeCheck v-if="entry.params?.magic?.last_charge_check" :uid="entry.uid" />
    <ItemMechanicPanel v-if="hasEffects" kind="effect" title="Эффекты оружия">
      <template v-if="bindings.effects.length" #summary><WeaponLinkedCharges :resources="bindings.effects" :interactive="canManage" @toggle="toggle" /></template>
      <ItemEffectLinks :item="source" />
    </ItemMechanicPanel>
    <WeaponChargedRulePanels :rules="[...bindings.damage, ...bindings.actions]" :item="source" :interactive="canManage" @toggle="toggle" />
  </div>
</template>
<script setup>
import { computed, inject, provide, unref } from 'vue'
import ConfirmedItemUsePanel from './ConfirmedItemUsePanel.vue'
import SelectedTargetPanel from './SelectedTargetPanel.vue'
import WeaponBonusTransferPanel from './WeaponBonusTransferPanel.vue'
import WeaponUsePanel from './WeaponUsePanel.vue'
import ItemLastChargeCheck from './ItemLastChargeCheck.vue'
import WeaponLinkedCharges from './WeaponLinkedCharges.vue'
import WeaponChargedRulePanels from './WeaponChargedRulePanels.vue'
import ItemEffectLinks from '@/features/items/components/ItemEffectLinks.vue'
import ItemMechanicPanel from '@/features/items/components/ItemMechanicPanel.vue'
import WeaponNotePanels from '@/features/items/components/WeaponNotePanels.vue'
import { confirmedItemUses } from '@/features/character-editor/lib/confirmedItemUses'
import { visibleWeaponNotes } from '@/features/character-editor/lib/weaponNotes'
import { weaponBlockResources } from '@/features/character-editor/lib/weaponBlockResources'
import { magicItemActive } from '@/features/character-editor/lib/characterMagicItems'
const props = defineProps({ entry: { type: Object, required: true } })
const ctx = inject('weaponsBlockCtx')
provide('weaponMechanicCollapse', true)
const canManage = computed(() => !!ctx.charCtx.ownerMode)
const values = computed(() => unref(ctx.charCtx.values) || {})
const source = computed(() => ctx.itemMap?.[props.entry.magic_item_id] || ctx.item(props.entry))
const active = computed(() => magicItemActive(source.value, props.entry, true, values.value))
const confirmed = computed(() => confirmedItemUses(values.value, unref(ctx.charCtx.characterResources?.itemsById) || new Map(), props.entry.uid))
const resources = computed(() => ctx.weaponResources?.(props.entry) || [])
const bindings = computed(() => weaponBlockResources(source.value, active.value ? resources.value : []))
const hasEffects = computed(() => active.value && !!source.value?.data?.status_effects?.length)
const notes = computed(() => visibleWeaponNotes(source.value, props.entry, true, values.value))
const hasUses = computed(() => active.value && !!source.value?.data?.weapon_uses?.length || props.entry.params?.magic?.weapon_use?.status === 'active')
const visible = computed(() => notes.value.length || confirmed.value.length || active.value && source.value?.data?.selected_target
  || props.entry.params?.magic?.selected_target || props.entry.params?.magic?.bonus_transfer || hasUses.value
  || hasEffects.value || bindings.value.damage.length || bindings.value.actions.length || props.entry.params?.magic?.last_charge_check)
function toggle(resource, pip) { if (canManage.value) ctx.toggleWeaponResource?.(resource, pip) }
</script>
<style scoped>
.weapon-item-mechanics { display: grid; gap: 10px; padding: 0 20px 14px 16px; cursor: default; }
</style>

<template>
  <div v-if="source?.data?.confirmed_uses?.length || ctx.item(entry)?.data?.selected_target || entry.params?.magic?.bonus_transfer || entry.params?.magic?.weapon_use?.status === 'active' || resources.length || hasEffects || entry.params?.magic?.last_charge_check" class="weapon-item-mechanics" @click.stop @pointerdown.stop>
    <div v-for="resource in resources" :key="resource.key" class="weapon-resource">
      <span>{{ resource.source?.resourceKey ? resource.title : 'Заряды' }}</span>
      <div class="weapon-resource-pips" role="group" :aria-label="`${resource.title}: ${resource.value} из ${resource.total}`">
        <button v-for="pip in resource.total" :key="pip" type="button" :disabled="!ctx.charCtx.ownerMode" :aria-label="`Заряд ${pip}`"
          :aria-pressed="pip <= resource.value" @click="ctx.toggleWeaponResource(resource, pip)">
          <SpellSlotSphere :spent="pip > resource.value" :size="28" :color="resource.color_point" :interactive="!!ctx.charCtx.ownerMode" />
        </button>
      </div>
      <ResourceRestIcons :resource="resource" />
    </div>
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
import ResourceRestIcons from '@/features/character-editor/blocks/generic/components/ResourceRestIcons.vue'
import { computed, inject } from 'vue'
import SpellSlotSphere from '@/features/items/components/SpellSlotSphere.vue'
import ItemEffectLinks from '@/features/items/components/ItemEffectLinks.vue'
const props = defineProps({ entry: { type: Object, required: true } })
const ctx = inject('weaponsBlockCtx')
const resources = computed(() => ctx.weaponResources?.(props.entry) || [])
const source = computed(() => ctx.itemMap?.[props.entry.magic_item_id] || ctx.item(props.entry))
const hasEffects = computed(() => !props.entry.params?.magic?.lost && !!source.value?.data?.status_effects?.length)
</script>
<style scoped>
.weapon-item-mechanics { display: grid; gap: 10px; padding: 0 20px 14px 16px; cursor: default; }
.weapon-resource { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; }
.weapon-resource > span { color: var(--text-2); font-size: 11px; font-weight: 650; }
.weapon-resource > small { flex-basis: 100%; color: var(--text-muted); font-size: 11px; }
.weapon-resource-pips { display: flex; gap: 4px; flex-wrap: wrap; }
.weapon-resource-pips > button { display: inline-flex; border: 0; padding: 0; background: none; border-radius: 6px; cursor: pointer; }
.weapon-resource-pips > button:disabled { cursor: default; }
.weapon-resource-pips > button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>

<template>
  <div v-if="rows.length" class="weapon-use-panels" @click.stop @pointerdown.stop>
    <ItemMechanicPanel v-for="rule in rows" :key="rule.key" kind="weapon_use" :title="rule.title">
      <template v-if="linked(rule).length" #summary><WeaponLinkedCharges :resources="linked(rule)" :interactive="!!charCtx.ownerMode" @toggle="toggle" /></template>
      <template v-if="isLive(rule)">
        <div v-for="step in event.steps.filter(row => row.kind === 'damage')" :key="step.key" class="weapon-use-stage">
          <strong>{{ step.title }}</strong><WeaponUseStep :step="step" :can-manage="!!charCtx.ownerMode" :busy="busy" @roll="resolve(step.key)" />
        </div>
      </template>
      <WeaponUseRulePreview v-else :rule="rule" />
      <template v-if="charCtx.ownerMode" #actions>
        <ActionButton v-if="isLive(rule)" variant="quiet" :disabled="busy" @click="finishOrConfirm">Завершить применение</ActionButton>
        <ActionButton v-else-if="weapons?.rollAttack" :disabled="busy || !choice(rule) || !!choice(rule).disabled" :title="choice(rule)?.error || undefined" @click="weapons.rollAttack(owned?.entry, { weaponUseKey: rule.key })">Бросить на атаку</ActionButton>
      </template>
      <ConfirmDialog v-if="isLive(rule) && confirmId" title="Завершить применение?" message="Неиспользованный дополнительный урон и оставшиеся броски будут закрыты. Потраченный ресурс не возвращается." confirm-text="Завершить" @confirm="finish(confirmId); confirmId = null" @cancel="confirmId = null" @close="confirmId = null" />
    </ItemMechanicPanel>
  </div>
</template>
<script setup>
import { computed, inject, ref, toRef, unref } from 'vue'
import { ActionButton, ConfirmDialog } from '@sylvieshare/share-ui'
import ItemMechanicPanel from '@/features/items/components/ItemMechanicPanel.vue'
import WeaponLinkedCharges from './WeaponLinkedCharges.vue'
import WeaponUseStep from './WeaponUseStep.vue'
import WeaponUseRulePreview from './WeaponUseRulePreview.vue'
import { useWeaponUseSteps } from '../composables/useWeaponUseSteps'
import { inventoryEntries, magicItemActive } from '@/features/character-editor/lib/characterMagicItems'
import { setCharacterResourceAvailable } from '@/features/character-editor/lib/characterResources'
import { logResourceChange } from '@/features/character-editor/lib/sessionEventData'
import { availableWeaponUses } from '@/features/character-editor/lib/weaponUses'
const props = defineProps({ uid: { type: String, required: true }, item: Object, resources: { type: Object, default: null } })
const emit = defineEmits(['toggle'])
const charCtx = inject('charCtx', {}), weapons = inject('weaponsBlockCtx', null)
const { event, busy, resolve, finish } = useWeaponUseSteps(charCtx, toRef(props, 'uid'))
const values = computed(() => unref(charCtx.values) || {})
const items = computed(() => unref(charCtx.characterResources?.itemsById) || new Map())
const owned = computed(() => inventoryEntries(values.value).find(row => row.entry.uid === props.uid))
const source = computed(() => props.item || items.value.get(String(owned.value?.entry.magic_item_id ?? owned.value?.entry.item_id)))
const choices = computed(() => availableWeaponUses(values.value, items.value, props.uid, !!charCtx.ownerMode))
const rows = computed(() => {
  const rules = magicItemActive(source.value, owned.value?.entry, owned.value?.equipped, values.value) ? [...(source.value.data.weapon_uses || [])] : []
  if (event.value?.status === 'active' && !rules.some(rule => rule.key === event.value.key)) rules.push(event.value)
  return rules
})
const confirmId = ref(null)
function choice(rule) { return choices.value.find(row => row.key === rule.key) }
function linked(rule) { return props.resources ? props.resources[rule.key] || [] : choice(rule)?.resource ? [choice(rule).resource] : [] }
function toggle(resource, pip) {
  if (!charCtx.ownerMode) return
  if (props.resources) { emit('toggle', resource, pip); return }
  const next = pip <= resource.value ? pip - 1 : pip
  const patch = setCharacterResourceAvailable(values.value, items.value, resource.key, next)
  if (Object.keys(patch).length) { charCtx.updateValues(patch); logResourceChange(charCtx, resource, next) }
}
function isLive(rule) { return event.value?.status === 'active' && event.value.key === rule.key }
function finishOrConfirm() { if (event.value.steps.some(step => step.status === 'pending')) confirmId.value = event.value.id; else finish(event.value.id) }
</script>
<style scoped>
.weapon-use-panels { display: grid; gap: 8px; }
.weapon-use-stage { display: grid; gap: 8px; }
.weapon-use-stage > strong { color: var(--text-1); font-size: 13px; }
</style>

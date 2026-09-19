<template>
  <RowActionSubmenu v-if="ctx.charCtx.ownerMode && applicable" :min-width="320" :disabled="ctx.spellcastingBlocked || controller?.busy">
    <template #trigger="{ open }">
      <RowActionItem :icon="WandSparkles" submenu :submenu-open="open" :disabled="ctx.spellcastingBlocked || controller?.busy" @click="!open && ctx.charCtx.topSession && controller?.loadPlayers()">Использовать на…</RowActionItem>
    </template>
    <template #default="{ close }">
      <SpellCastControls :entry="entry" :cast-level="castLevel" :spend-by-default="ctx.availableSpellSlotOptions(entry).length > 0" application>
        <template #default="cast">
          <div v-if="links.length > 1" class="spell-application-options">
            <label v-for="link in links" :key="link.key"><input v-model="optionKey" type="radio" :value="link.key" />{{ link.name }}</label>
          </div>
          <p v-if="selectedCondition" class="spell-condition">{{ selectedCondition }}</p>
          <ToggleSwitch v-if="selectedCondition" v-model="conditionsMet" label="Условия выполнены" />
          <DamageFormulaPreview v-if="entry.item.data?.heal?.dices?.length" :expression="ctx.spellHealPreview(entry, cast.castLevel)" label="Лечение" default-color="var(--success)" />
          <RowActionSeparator />
          <div v-if="maximum(cast) > 1" class="spell-target-caption">Выберите до {{ maximum(cast) }} целей · выбрано {{ selected.length + dmCount }}</div>
          <label v-if="maximum(cast) > 1" class="spell-target-option">
            <input type="checkbox" :checked="selected.includes('self')" :disabled="blocked('self', cast)" @change="toggle('self')" /><UserRound :size="22" />На себя
          </label>
          <RowActionItem v-else :icon="UserRound" :disabled="cannotApply(cast)" @click="apply(cast, ['self'], 0, close)">На себя</RowActionItem>
          <template v-if="othersAllowed">
            <fieldset v-if="maximum(cast) > 1" class="spell-dm-count" aria-label="Целей мастеру" :disabled="cast.disabled"><span>Целей мастеру</span>
              <FormNumberInput :value="dmCount" @change="dmCount = $event" :min="0" :max="Math.max(0, maximum(cast) - selected.length)" />
            </fieldset>
            <RowActionItem v-else :icon="Crown" :disabled="cannotApply(cast)" @click="apply(cast, [], 1, close)">Мастер — выберет цель</RowActionItem>
            <LoadingIndicator v-if="controller?.state.loading" label="Загрузка игроков" />
            <template v-for="player in controller?.recipients || []" :key="player.charUuid">
              <label v-if="maximum(cast) > 1" class="spell-target-option">
                <input type="checkbox" :checked="selected.includes(player.charUuid)" :disabled="blocked(player.charUuid, cast)" @change="toggle(player.charUuid)" />
                <img v-if="pvAvatar(player)" :src="pvAvatar(player)" alt="" /><UserRound v-else :size="22" />{{ pvName(player) }}
              </label>
              <RowActionItem v-else :disabled="cannotApply(cast)" @click="apply(cast, [player.charUuid], 0, close)">
                <template #icon><img v-if="pvAvatar(player)" class="spell-target-avatar" :src="pvAvatar(player)" alt="" /><UserRound v-else :size="22" /></template>{{ pvName(player) }}
              </RowActionItem>
            </template>
          </template>
          <p v-if="controller?.state.error" class="spell-application-error" role="alert">{{ controller.state.error }}</p>
          <ActionButton v-if="maximum(cast) > 1" :disabled="cannotApply(cast) || selected.length + dmCount < 1 || selected.length + dmCount > maximum(cast)" @click="apply(cast, selected, dmCount, close)">Применить · {{ selected.length + dmCount }} / {{ maximum(cast) }}</ActionButton>
        </template>
      </SpellCastControls>
    </template>
  </RowActionSubmenu>
</template>
<script setup>
import { computed, inject, ref, watch } from 'vue'
import { Crown, UserRound, WandSparkles } from '@lucide/vue'
import { ActionButton, FormNumberInput, LoadingIndicator, RowActionSubmenu, ToggleSwitch } from '@sylvieshare/share-ui'
import { statusEffectLinks } from '@/features/character-editor/lib/characterStatuses'
import { effectAppliesIn } from '@/shared/lib/effectApplicationContext'
import { pvAvatar, pvName } from '@/features/sessions/lib/participantView'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import RowActionSeparator from '@/shared/ui/RowActionSeparator.vue'
import SpellCastControls from './SpellCastControls.vue'
import DamageFormulaPreview from './DamageFormulaPreview.vue'
const props = defineProps({ entry: Object, castLevel: Number })
const emit = defineEmits(['close'])
const ctx = inject('spellsBlockCtx')
const controller = computed(() => ctx.charCtx.itemTransfers)
const links = computed(() => statusEffectLinks(props.entry.item).filter(link => effectAppliesIn(link, 'cast')).map(link => ({ ...link, name: ctx.charCtx.characterResources?.itemsById?.get?.(String(link.effect_id))?.name || link.key })))
const applicable = computed(() => links.value.length || (props.entry.item?.data?.heal?.apply !== false && props.entry.item?.data?.heal?.dices?.length))
const optionKey = ref(links.value[0]?.key || '')
watch(() => links.value.map(link => link.effect_id).join(','), () => ctx.charCtx.characterResources?.ensureItems?.(links.value.map(link => link.effect_id)), { immediate: true })
watch(links, value => { if (!value.some(link => link.key === optionKey.value)) optionKey.value = value[0]?.key || '' })
const conditionsMet = ref(false)
const selectedCondition = computed(() => links.value.find(link => link.key === optionKey.value)?.condition || '')
watch(selectedCondition, () => { conditionsMet.value = false })
const selected = ref([]), dmCount = ref(0)
const othersAllowed = computed(() => props.entry.item?.data?.application_targets?.self_only !== true && ctx.charCtx.topSession && controller.value?.state.settings?.interactions?.spells !== false)
watch(othersAllowed, allowed => { if (!allowed) { selected.value = selected.value.filter(key => key === 'self'); dmCount.value = 0 } })
const maximum = cast => props.entry.item?.data?.application_targets?.self_only ? 1 : Math.min(50, Math.max(1, Number(props.entry.item.data.application_targets?.count) || 1) + Math.max(0, Number(props.entry.item.data.application_targets?.per_slot) || 0) * Math.max(0, cast.castLevel - (Number(props.entry.item.data.lvl) || 0)))
const cannotApply = cast => !!(cast.disabled || (selectedCondition.value && !conditionsMet.value))
const blocked = (key, cast) => cannotApply(cast) || (!selected.value.includes(key) && selected.value.length + dmCount.value >= maximum(cast))
function toggle(key) { selected.value = selected.value.includes(key) ? selected.value.filter(x => x !== key) : [...selected.value, key] }
async function apply(cast, targets, count, close) {
  if (cannotApply(cast)) return
  const done = await controller.value?.castSpell(props.entry, { castLevel: cast.castLevel, pool: cast.pool, spendSlot: cast.spend, targets: [...targets], dmCount: Number(count) || 0, optionKey: optionKey.value })
  if (done) { ctx.rememberSpellRollLevel(props.entry, cast.castLevel); close(); emit('close') }
}
</script>
<style scoped>
.spell-application-options { display: grid; gap: 8px; }
.spell-application-options label, .spell-target-option { display: flex; align-items: center; gap: 10px; padding: 7px 4px; font-size: 13px; cursor: pointer; }
.spell-target-option:has(input:disabled) { opacity: .45; cursor: default; }
.spell-target-option input { accent-color: var(--accent); width: 16px; height: 16px; }
.spell-target-option img, .spell-target-avatar { width: 32px; height: 32px; object-fit: contain; }
.spell-target-caption { color: var(--text-muted); font-size: 12px; }
.spell-dm-count { border: 0; padding: 0; margin: 4px 0; }
.spell-dm-count { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 13px; }
.spell-application-error { color: var(--danger); font-size: 12px; }
</style>

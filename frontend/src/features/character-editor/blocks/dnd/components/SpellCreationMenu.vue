<template>
  <RowActionSubmenu v-if="ctx.charCtx.ownerMode && options.length" :min-width="340" :disabled="ctx.spellcastingBlocked || controller?.state.busy">
    <template #trigger="{ open }"><RowActionItem :icon="PackagePlus" submenu :submenu-open="open">Создать предметы</RowActionItem></template>
    <template #default="{ close }">
      <SpellCastControls :entry="entry" :cast-level="castLevel" :spend-by-default="ctx.availableSpellSlotOptions(entry).length > 0" application>
        <template #default="cast">
          <div class="creation-menu">
            <label v-for="option in options.length > 1 ? options : []" :key="option.key" class="creation-choice"><input v-model="selected" type="radio" :value="option.key" />{{ option.title }}</label>
            <HandbookReferenceRows :rows="rows(cast.castLevel)">
              <template #leading="{ row }"><strong>×{{ row.count }}</strong></template>
              <template #description="{ row }"><small v-if="row.duration">{{ statusDuration(row.duration) }}</small></template>
            </HandbookReferenceRows>
            <label v-if="choice?.choose_count && choice.outputs?.length === 1" class="creation-quantity">Количество<FormNumberInput :value="quantity || maximum(cast.castLevel)" :min="1" :max="maximum(cast.castLevel)" @change="quantity = $event" /></label>
            <template v-if="choice?.condition"><p>{{ choice.condition }}</p><ToggleSwitch v-model="conditionsMet" label="Условия выполнены" /></template>
            <p v-if="controller?.state.error" role="alert" class="creation-error">{{ controller.state.error }}</p>
            <ActionButton :disabled="cast.disabled || (choice?.condition && !conditionsMet)" @click="create(cast, close)">Создать в рюкзаке</ActionButton>
          </div>
        </template>
      </SpellCastControls>
    </template>
  </RowActionSubmenu>
</template>
<script setup>
import { computed, inject, ref, watch } from 'vue'
import { PackagePlus } from '@lucide/vue'
import { ActionButton, FormNumberInput, RowActionSubmenu, ToggleSwitch } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import HandbookReferenceRows from '@/features/items/components/HandbookReferenceRows.vue'
import { statusDuration } from '@/shared/lib/statusDuration'
import SpellCastControls from './SpellCastControls.vue'
const props = defineProps({ entry: Object, castLevel: Number })
const emit = defineEmits(['close'])
const ctx = inject('spellsBlockCtx')
const controller = computed(() => ctx.charCtx.itemTransfers)
const options = computed(() => props.entry.item?.data?.item_creation || [])
const selected = ref(''), quantity = ref(0), conditionsMet = ref(false)
const choice = computed(() => options.value.find(option => option.key === selected.value) || options.value[0])
watch(choice, () => { quantity.value = 0; conditionsMet.value = false })
const outputCount = (output, level) => Number(output.count ?? 1) + Math.floor(Math.max(0, level - Number(props.entry.item.data.lvl || 0)) / Math.max(1, Number(output.scaling_step) || 1)) * Math.max(0, Number(output.per_slot) || 0)
const maximum = level => outputCount(choice.value?.outputs?.[0] || {}, level)
const rows = level => (choice.value?.outputs || []).map(output => ({ id: output.item, count: choice.value?.choose_count && quantity.value ? Math.min(quantity.value, maximum(level)) : outputCount(output, level), duration: output.duration }))
async function create(cast, close) {
  if (cast.disabled || !choice.value || (choice.value.condition && !conditionsMet.value)) return
  if (await controller.value.castSpell(props.entry, { creationKey: choice.value.key, createdCount: choice.value.choose_count ? Math.min(quantity.value || maximum(cast.castLevel), maximum(cast.castLevel)) : 0, castLevel: cast.castLevel, pool: cast.pool, spendSlot: cast.spend, targets: ['self'], dmCount: 0 })) {
    ctx.rememberSpellRollLevel(props.entry, cast.castLevel); close(); emit('close')
  }
}
</script>
<style scoped>
.creation-menu { display: grid; gap: 12px; }
.creation-menu p { margin: 0; font-size: 13px; }
.creation-choice, .creation-quantity { display: flex; align-items: center; gap: 10px; }
.creation-quantity { justify-content: space-between; }
.creation-menu small { color: var(--text-muted); }
.creation-error { color: var(--danger); }
</style>

<template>
  <CharacterItemSkeleton v-if="!entry.item && ctx.itemLoading?.(entry.ref.id)" />
  <RowActionMenu v-else ref="actionMenu" :heading="entry.item?.name" block :disabled="draggedThisGesture">
    <template #trigger="{ open: menuOpen }">
      <BaseTile :outlined="false" :interactive="!!entry.item"
        class="spell-row action-menu-source"
        :class="{
          'spell-row-clickable': !!entry.item,
          'spell-row-draggable': ctx.charCtx.ownerMode && !standalone,
          'spell-row-prepared': isPrepared,
          'sortable-placeholder': ctx.sortable.isSource(entry),
          'action-menu-source--open': menuOpen,
        }"
        :data-sortable-key="entry.ref.key"
        @pointerdown="onRowDown"
      >
    <button v-if="!entry.item" type="button" @click.stop="ctx.retryItems?.()">Повторить загрузку</button>
    <PreparedSpellBrackets
      v-if="isPrepared"
      class="sp-prepared-brackets"
      :permanent="false"
    />

    <SpellCardContent :item="entry.item" :school="school" :name-en="nameEn" :grant-summary="grantSummary"
      :range-override="ctx.spellRangeOverride?.(entry.item)" :scaling-hint="scalingHint">
    <template v-if="hasMetrics" #metrics>
      <span v-if="saveTag" class="sp-save" title="Спасбросок">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" /></svg>
        {{ saveTag }}
      </span>
      <span v-if="instances > 1" class="sp-mul">×{{ instances }}</span>
      <AttackDamage rollable
        @roll-attack="openDirectRoll('attack', $event)" @roll-damage="openDirectRoll('damage', $event)" @roll-heal="openDirectRoll('heal', $event)"
        :attack="entry.item?.data?.damage?.range_attack ? ctx.formatBonus(ctx.spellAttackBonus(entry)) : null"
        :damage-parts="damageParts"
        :modifier="damageModifier"
        :heal-parts="healParts"
        :heal-kind="data.heal?.kind"
        :heal-modifier="healModifier"
      >
        <template v-if="canUpcast && hasInlineSpellScaling(data.damage)" #damage-suffix>
          <SpellScalingFormula :rule="data.damage" :base-level="baseLvl" />
        </template>
        <template v-if="canUpcast && hasInlineSpellScaling(data.heal)" #heal-suffix>
          <SpellScalingFormula :rule="data.heal" :base-level="baseLvl" :color="data.heal?.kind === 'temporary_hp' ? 'var(--info)' : 'var(--success)'" />
        </template>
      </AttackDamage>
    </template>
      <template #effects><SpellEffectFormulas :entry="entry" :cast-level="castLevel" /></template>
    </SpellCardContent>
      </BaseTile>
    </template>

    <template #default="{ close }">
      <SpellCreationMenu :entry="entry" :cast-level="castLevel" @close="close" />
      <SpellApplicationMenu ref="applicationMenu" :entry="entry" :cast-level="castLevel" @close="close" />
      <SpellRollMenu ref="rollMenu" :entry="entry" :cast-level="castLevel" @close="close" />
      <RowActionSeparator v-if="hasMetrics" />
      <RowActionItem action="view" @click="openDetails(close)">Открыть описание</RowActionItem>
      <RowActionItem
        v-if="ctx.charCtx.ownerMode && canPrepare"
        action="prepare"
        :disabled="ctx.canPrepareEntry && !ctx.canPrepareEntry(entry)"
        :title="ctx.canPrepareEntry && !ctx.canPrepareEntry(entry) ? 'Лимит подготовки: сначала снимите подготовку другого заклинания' : ''"
        :icon="Sprout"
        tone="accent"
        @click="togglePreparation(close)"
      >
        {{ isPrepared ? 'Снять подготовку' : 'Подготовить' }}
      </RowActionItem>
      <RowActionSubmenu
        v-if="ctx.charCtx.ownerMode && ctx.spellcastingSources.length > 1 && !isReadonlyGrant"
        label="Класс заклинания"
      >
        <template #trigger="{ open }">
          <RowActionItem action="source" submenu :submenu-open="open">
            Класс заклинания
          </RowActionItem>
        </template>
        <template #default="{ close: closeSources }">
          <RowActionItem
            v-for="source in ctx.spellcastingSources"
            :key="source.key"
            action="source"
            :tone="source.key === ctx.activeTabKey ? 'accent' : 'default'"
            @click="setSource(source.key, closeSources, close)"
          >{{ source.label }}</RowActionItem>
        </template>
      </RowActionSubmenu>
      <RowActionSubmenu
        v-if="ctx.charCtx.ownerMode && spendsSlot && canUse && hasHigherLevelChoice"
        label="Выберите ячейку"
      >
        <template #trigger="{ open }">
          <RowActionItem action="use" tone="accent" submenu :submenu-open="open">
            Потратить ячейку
          </RowActionItem>
        </template>
        <template #default="{ close: closeSlots }">
          <RowActionItem
            v-for="option in slotOptions"
            :key="option.level"
            action="use"
            tone="accent"
            @click="useAtSlot(option, closeSlots, close)"
          >
            {{ option.level }} круг
            <template #suffix>({{ option.remaining }}/{{ option.total }})</template>
          </RowActionItem>
        </template>
      </RowActionSubmenu>
      <RowActionItem
        v-else-if="ctx.charCtx.ownerMode && spendsSlot"
        action="use"
        tone="accent"
        :disabled="!canUse"
        @click="useWithoutChoice(close)"
      >
        {{ useLabel }}
      </RowActionItem>
      <RowActionItem v-if="ctx.charCtx.ownerMode && entry.item?.data?.concentration" :icon="Focus" :disabled="ctx.spellcastingBlocked || ctx.charCtx.itemTransfers?.busy" @click="startConcentration(close)">Начать концентрацию</RowActionItem>
      <RowActionItem
        v-if="ctx.charCtx.ownerMode && !isReadonlyGrant"
        action="delete"
        tone="danger"
        @click="removeSpell(close)"
      >Удалить</RowActionItem>
    </template>
  </RowActionMenu>
</template>

<script setup>
import SpellCardContent from './SpellCardContent.vue'
import SpellApplicationMenu from './SpellApplicationMenu.vue'
import SpellCreationMenu from './SpellCreationMenu.vue'
import { Focus, Sprout } from '@lucide/vue'
import SpellEffectFormulas from './SpellEffectFormulas.vue'
import SpellScalingFormula from './SpellScalingFormula.vue'
import { hasInlineSpellScaling, spellScalingHint, spellInstances } from '../lib/spellScaling'
import { computed, inject, nextTick, ref, watch } from 'vue'

import SpellRollMenu from './SpellRollMenu.vue'
import CharacterItemSkeleton from '@/features/character-editor/components/sheet/CharacterItemSkeleton.vue'
import RowActionSeparator from '@/shared/ui/RowActionSeparator.vue'
import AttackDamage from '@/features/character-editor/blocks/dnd/components/AttackDamage.vue'
import PreparedSpellBrackets from '@/features/character-editor/blocks/dnd/components/PreparedSpellBrackets.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { BaseTile, RowActionMenu } from '@sylvieshare/share-ui'
import { RowActionSubmenu } from '@sylvieshare/share-ui'
import { SAVE_ABBR } from '@/shared/lib/dndStats'

const props = defineProps({
  entry: { type: Object, required: true },
  level: { type: Number, required: true },
  idx:   { type: Number, required: true },
  standalone: { type: Boolean, default: false },
})

const ctx = inject('spellsBlockCtx')
const actionMenu = ref(null), rollMenu = ref(null), applicationMenu = ref(null)
async function openDirectRoll(kind, event) {
  actionMenu.value?.open(event)
  await nextTick()
  if (kind === 'heal' && props.entry.item?.data?.heal?.apply !== false) applicationMenu.value?.open()
  else rollMenu.value?.openRoll(kind)
}

const data = computed(() => props.entry.item?.data || {})
const nameEn = computed(() => String(props.entry.item?.nameEn || '').trim())
const dmg = computed(() => data.value.damage || {})
const school = computed(() => ctx.schoolMeta(props.entry.item))

const baseLvl = computed(() => Number(data.value.lvl) || 0)
const isReadonlyGrant = computed(() => props.standalone || !!props.entry.ref.source)
const canPrepare = computed(() => !!ctx.spellCanPrepare(props.entry) && baseLvl.value > 0 && !isReadonlyGrant.value)
const isPrepared = computed(() => canPrepare.value && !!props.entry.ref.prepared)
const grantSummary = computed(() => {
  const sourceLabel = String(props.entry.ref.source?.label || '').trim()
  if (!sourceLabel) return ''
  const ability = props.entry.ref.casting_ability != null ? ctx.spellAbilityLabel(props.entry) : ''
  const castLevel = Number(props.entry.ref.cast_level) || 0
  const details = [ability, castLevel ? `${castLevel} круг` : ''].filter(Boolean)
  return details.length ? `${sourceLabel} · ${details.join(' · ')}` : sourceLabel
})
const fixedCastLevel = computed(() => Number(props.entry.ref.cast_level) || null)
const castLevel = computed(() => fixedCastLevel.value || baseLvl.value)

const damageParts = computed(() => ctx.damageDiceParts(props.entry.item, castLevel.value, ctx.charLevel, ctx.spellAbilityModifier?.(props.entry) || 0))
const healParts = computed(() => ctx.healDiceParts(props.entry.item, castLevel.value, ctx.charLevel, ctx.spellAbilityModifier?.(props.entry) || 0))
const healModifier = computed(() => healParts.value.reduce((sum, part) => sum + (part.bonus || 0), 0))
const canUpcast = computed(() => !props.entry.ref?.slotless && ctx.maxSlotLevel > baseLvl.value)
const needsScalingHint = rule => !hasInlineSpellScaling(rule) && (rule?.scaling !== 'slot' || canUpcast.value)
const scalingHint = computed(() => props.entry.ref?.slotless ? '' : spellScalingHint({ data: {
  ...data.value,
  damage: needsScalingHint(data.value.damage) ? data.value.damage : undefined,
  heal: needsScalingHint(data.value.heal) ? data.value.heal : undefined,
  rolls: (data.value.rolls || []).filter(needsScalingHint),
} }))
const damageModifier = computed(() => damageParts.value.reduce((s, p) => s + (p.bonus || 0), 0))
const hasMetrics = computed(() => ctx.hasSpellMetrics(props.entry.item))

const saveTag = computed(() => {
  const a = dmg.value.save_ability
  if (!a) return ''
  return (SAVE_ABBR[a] || String(a).toUpperCase()) + (dmg.value.save_effect === 'half' ? ' ½' : '')
})
const instances = computed(() => spellInstances(props.entry.item, castLevel.value, ctx.charLevel))
const slotOptions = computed(() => ctx.groupedSpellSlotOptions(props.entry))
const spendsSlot = computed(() => baseLvl.value > 0 && !props.entry.ref.slotless)
const canUse = computed(() => !ctx.spellcastingBlocked && !!props.entry.item && (baseLvl.value === 0 || slotOptions.value.length > 0))
const useLabel = computed(() => ctx.spellcastingBlocked ? 'Сотворение недоступно' : (canUse.value ? 'Потратить ячейку' : 'Нет доступных ячеек'))
const hasHigherLevelChoice = computed(() =>
  !props.entry.ref.slotless && (slotOptions.value.length > 1 || slotOptions.value.some(option => option.level > baseLvl.value))
)

// Hold the row to reorder; a quick horizontal gesture remains a sheet swipe. A drag flips
// `sortable.dragging` mid-gesture — we remember it so the trailing click doesn't open the spell modal.
const draggedThisGesture = ref(false)
watch(() => ctx.sortable.dragging, v => { if (v) draggedThisGesture.value = true })

function onRowDown(e) {
  if (e.target.closest('button')) return
  if (isReadonlyGrant.value || props.standalone) return
  draggedThisGesture.value = false
  ctx.onSpellDragStart(e, props.entry, props.level, props.idx)
}

function openDetails(close) {
  ctx.openSpell(props.entry)
  close()
}

function togglePreparation(close) {
  ctx.togglePrepared(props.entry.ref.key)
  close()
}

async function useWithoutChoice(close) {
  if (!canUse.value) return
  await ctx.useSpell(props.entry, slotOptions.value[0])
  close()
}

async function useAtSlot(option, closeSubmenu, closeMenu) {
  await ctx.useSpell(props.entry, option)
  closeSubmenu()
  closeMenu()
}

function setSource(key, closeSubmenu, closeMenu) {
  ctx.setSpellcastingSource(props.entry, key)
  closeSubmenu()
  closeMenu()
}

async function startConcentration(close) {
  close()
  await ctx.charCtx.itemTransfers?.concentration.start(props.entry.item)
}

function removeSpell(close) {
  ctx.removeSpell(props.entry.ref.key)
  close()
}
</script>

<style scoped>
.spell-row {position:relative;isolation:isolate;overflow:hidden;min-width:0;container-type:inline-size}
.spell-row-clickable {cursor:pointer}
.spell-row-draggable {cursor:grab;touch-action:pan-y}
.spell-row-draggable:active {cursor:grabbing}
.sp-prepared-brackets {position:absolute;z-index:2;inset:var(--spacing-compact);color:color-mix(in srgb,var(--accent) 62%,transparent);pointer-events:none}
.sp-save {display:inline-flex;align-items:center;gap:var(--spacing-xs);color:var(--text-2);font-size:var(--type-context-size);font-weight:700;white-space:nowrap}
.sp-mul {color:var(--text-2);font-size:var(--type-group-size);font-weight:700}
.sortable-placeholder {background:color-mix(in srgb,var(--accent) 8%,transparent)!important;outline:2px dashed color-mix(in srgb,var(--accent) 50%,transparent);outline-offset:-2px}
.sortable-placeholder>* {visibility:hidden}
</style>

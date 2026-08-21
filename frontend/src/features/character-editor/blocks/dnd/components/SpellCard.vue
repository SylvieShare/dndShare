<template>
  <RowActionMenu block :disabled="draggedThisGesture">
    <template #trigger>
      <div
        class="spell-row"
        :class="{
          'spell-row-clickable': !!entry.item,
          'spell-row-draggable': ctx.charCtx.ownerMode && !isReadonlyGrant,
          'spell-row-prepared': isPrepared,
          'spell-row-permanent': isAlwaysPrepared,
          'sortable-placeholder': ctx.sortable.isSource(entry),
        }"
        :data-sortable-key="entry.ref.id"
        @pointerdown="onRowDown"
      >
    <PreparedSpellBrackets
      v-if="isPrepared"
      class="sp-prepared-brackets"
      :permanent="isAlwaysPrepared"
    />

    <div class="sp-lead">
      <ItemIcon
        v-if="entry.item?.iconImageUrl"
        class="sp-item-icon"
        :item="entry.item"
        :fallback-to-type="false"
        :size="64"
      />
      <span
        v-else-if="school"
        class="sp-school"
        :style="{ color: school.color || 'var(--text-muted)' }"
        :title="school.value"
      >
        <span v-if="school.svg" class="sp-school-svg" v-html="school.svg" />
        <svg v-else viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
          <path d="M12 2l1.7 6.1 6.3 1.9-6.3 1.9L12 18l-1.7-6.1L4 10l6.3-1.9z" />
        </svg>
      </span>
    </div>

    <div class="sp-info">
      <div class="sp-name-row">
        <span class="sp-name">{{ entry.item ? entry.item.name : '...' }}</span>
        <span v-if="nameEn" class="sp-name-en">{{ nameEn }}</span>
        <span v-if="data.concentration" class="sp-tag sp-tag-conc" title="Концентрация">К</span>
        <span v-if="data.ritual" class="sp-tag sp-tag-ritual" title="Ритуал">Р</span>
      </div>
      <span v-if="entry.item?.data" class="sp-meta">{{ ctx.spellMetaLine(entry.item) }}</span>
      <span v-if="grantSummary" class="sp-grant">{{ grantSummary }}</span>
    </div>

    <div v-if="hasMetrics" class="sp-metrics">
      <span v-if="saveTag" class="sp-save" title="Спасбросок">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" /></svg>
        {{ saveTag }}
      </span>
      <span v-if="instances > 1" class="sp-mul">×{{ instances }}</span>
      <span v-if="isSlotScaled" class="sp-step" title="Круг ячейки" @pointerdown.stop @click.stop>
        <button type="button" class="sp-step-btn" :disabled="castLevel <= baseLvl" @click.stop="decCast">−</button>
        <span class="sp-step-val">{{ castLevel }}<small>круг</small></span>
        <button type="button" class="sp-step-btn" :disabled="castLevel >= maxCast" @click.stop="incCast">+</button>
      </span>
      <AttackDamage
        :attack="entry.item?.data?.damage?.range_attack ? ctx.formatBonus(ctx.spellAttackBonus(entry)) : null"
        :damage-parts="damageParts"
        :modifier="damageModifier"
        :heal-parts="healParts"
        :rollable="true"
        @roll-attack="ctx.rollSpellAttack(entry)"
        @roll-damage="ctx.rollSpellDamage(entry, castLevel)"
        @roll-heal="ctx.rollSpellHeal(entry, castLevel)"
      />
    </div>

      </div>
    </template>

    <template #default="{ close }">
      <RowActionItem action="view" @click="openDetails(close)">Открыть описание</RowActionItem>
      <RowActionItem
        v-if="ctx.charCtx.ownerMode && canPrepare && !isAlwaysPrepared"
        action="prepare"
        :icon="Sprout"
        tone="accent"
        @click="togglePreparation(close)"
      >
        {{ isPrepared ? 'Снять подготовку' : 'Подготовить' }}
      </RowActionItem>
      <RowActionItem
        v-if="ctx.charCtx.ownerMode && canPrepare"
        action="always-prepare"
        :icon="BookMarked"
        tone="warning"
        @click="toggleAlwaysPrepared(close)"
      >
        {{ isAlwaysPrepared ? 'Убрать постоянное изучение' : 'Изучено навсегда' }}
      </RowActionItem>
      <RowActionSubmenu
        v-if="ctx.charCtx.ownerMode && canUse && hasHigherLevelChoice"
        label="Выберите ячейку"
      >
        <template #trigger="{ open }">
          <RowActionItem action="use" tone="accent" submenu :submenu-open="open">
            Использовать
          </RowActionItem>
        </template>
        <template #default="{ close: closeSlots }">
          <RowActionItem
            v-for="levelOption in slotOptions"
            :key="levelOption"
            action="use"
            tone="accent"
            @click="useAtLevel(levelOption, closeSlots, close)"
          >
            {{ levelOption }} круг
            <template #suffix>{{ ctx.slotRemaining(levelOption) }} доступно</template>
          </RowActionItem>
        </template>
      </RowActionSubmenu>
      <RowActionItem
        v-else-if="ctx.charCtx.ownerMode"
        action="use"
        tone="accent"
        :disabled="!canUse"
        @click="useWithoutChoice(close)"
      >
        {{ canUse ? 'Использовать' : 'Нет доступных ячеек' }}
      </RowActionItem>
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
import { BookMarked, Sprout } from '@lucide/vue'
import { computed, inject, ref, watch } from 'vue'

import AttackDamage from '@/features/character-editor/blocks/dnd/components/AttackDamage.vue'
import PreparedSpellBrackets from '@/features/character-editor/blocks/dnd/components/PreparedSpellBrackets.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import { RowActionSubmenu } from '@sylvieshare/share-ui'
import { SAVE_ABBR } from '@/shared/lib/dndStats'

const props = defineProps({
  entry: { type: Object, required: true },
  level: { type: Number, required: true },
  idx:   { type: Number, required: true },
})

const ctx = inject('spellsBlockCtx')

const data = computed(() => props.entry.item?.data || {})
const nameEn = computed(() => String(props.entry.item?.nameEn || '').trim())
const dmg = computed(() => data.value.damage || {})
const school = computed(() => ctx.schoolMeta(props.entry.item))

// Круг каста: для slot-роста степпер от базового круга заклинания до макс. доступного героем.
const baseLvl = computed(() => Number(data.value.lvl) || 0)
const isReadonlyGrant = computed(() => !!props.entry.ref.external_only)
const canPrepare = computed(() => !!ctx.preparation && baseLvl.value > 0 && !isReadonlyGrant.value)
const isAlwaysPrepared = computed(() => canPrepare.value && !!props.entry.ref.always_prepared)
const isPrepared = computed(() => canPrepare.value && (isAlwaysPrepared.value || !!props.entry.ref.prepared))
const grantSummary = computed(() => {
  const sources = Array.isArray(props.entry.ref.granted_by) ? props.entry.ref.granted_by : []
  const labels = [...new Set(sources.map((source) => String(source?.label || '').trim()).filter(Boolean))]
  if (!labels.length) return ''
  const sourceLabel = labels.length === 1
    ? `Даровано особенностью «${labels[0]}»`
    : `Даровано особенностями: ${labels.join(', ')}`
  const ability = props.entry.ref.casting_ability != null ? ctx.spellAbilityLabel(props.entry) : ''
  return ability ? `${sourceLabel} · Заклинательная характеристика: ${ability}` : sourceLabel
})
const maxCast = computed(() => Math.max(baseLvl.value, Number(ctx.maxSlotLevel) || 0))
const castOverride = ref(null)
const castLevel = computed(() => {
  const v = castOverride.value ?? baseLvl.value
  return Math.min(Math.max(v, baseLvl.value), maxCast.value)
})
const isSlotScaled = computed(() =>
  (dmg.value.scaling === 'slot' || data.value.heal?.scaling === 'slot') && maxCast.value > baseLvl.value
)
function incCast() { if (castLevel.value < maxCast.value) castOverride.value = castLevel.value + 1 }
function decCast() { if (castLevel.value > baseLvl.value) castOverride.value = castLevel.value - 1 }

const damageParts = computed(() => ctx.damageDiceParts(props.entry.item, castLevel.value, ctx.charLevel))
const healParts = computed(() => ctx.healDiceParts(props.entry.item, castLevel.value, ctx.charLevel))
const damageModifier = computed(() => damageParts.value.reduce((s, p) => s + (p.bonus || 0), 0))
const hasMetrics = computed(() => ctx.hasSpellMetrics(props.entry.item))

const saveTag = computed(() => {
  const a = dmg.value.save_ability
  if (!a) return ''
  return (SAVE_ABBR[a] || String(a).toUpperCase()) + (dmg.value.save_effect === 'half' ? ' ½' : '')
})
const instances = computed(() => Number(dmg.value.instances) || 1)
const slotOptions = computed(() => ctx.availableSpellSlotLevels(props.entry))
const canUse = computed(() => !!props.entry.item && (baseLvl.value === 0 || slotOptions.value.length > 0))
const hasHigherLevelChoice = computed(() =>
  slotOptions.value.some(level => level > baseLvl.value)
)

// Drag the whole row to reorder; the sortable's 4px threshold keeps a plain tap a click. A drag flips
// `sortable.dragging` mid-gesture — we remember it so the trailing click doesn't open the spell modal.
const draggedThisGesture = ref(false)
watch(() => ctx.sortable.dragging, v => { if (v) draggedThisGesture.value = true })

function onRowDown(e) {
  if (e.target.closest('button')) return
  if (isReadonlyGrant.value) return
  draggedThisGesture.value = false
  ctx.onSpellDragStart(e, props.entry, props.level, props.idx)
}

function openDetails(close) {
  ctx.openSpell(props.entry)
  close()
}

function togglePreparation(close) {
  ctx.togglePrepared(props.entry.ref.id)
  close()
}

function toggleAlwaysPrepared(close) {
  ctx.toggleAlwaysPrepared(props.entry.ref.id)
  close()
}

function useWithoutChoice(close) {
  if (!canUse.value) return
  const level = baseLvl.value === 0 ? 0 : slotOptions.value[0]
  ctx.useSpell(props.entry, level)
  close()
}

function useAtLevel(level, closeSubmenu, closeMenu) {
  ctx.useSpell(props.entry, level)
  closeSubmenu()
  closeMenu()
}

function removeSpell(close) {
  ctx.removeSpell(props.entry.ref.id)
  close()
}
</script>

<style scoped>
.spell-row {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 60px;
  padding: 12px 4px;
  transition: background 0.12s, padding 0.15s;
  cursor: default;
}
.spell-row-prepared { padding-inline: 28px; }
.spell-row > :not(.sp-prepared-brackets) {
  position: relative;
  z-index: 1;
}
.sp-prepared-brackets {
  position: absolute;
  z-index: 2;
  inset: 7px 10px;
  color: color-mix(in srgb, var(--accent) 62%, transparent);
  pointer-events: none;
}
.spell-row-permanent .sp-prepared-brackets {
  color: color-mix(in srgb, var(--warning) 68%, transparent);
}
.spell-row-clickable { cursor: pointer; }
.spell-row-draggable { cursor: grab; touch-action: pan-y; }
.spell-row-draggable:active { cursor: grabbing; }
@media (hover: hover) {
  .spell-row-clickable:hover { background: color-mix(in srgb, var(--text-on-accent) 2.5%, transparent); }
}

.sp-lead {
  flex: none;
  display: flex;
  align-items: center;
  gap: 11px;
}

.sp-school {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: none;
}
.sp-item-icon { flex: none; }
.sp-school-svg { display: inline-flex; }
.sp-school-svg :deep(svg) { width: 20px; height: 20px; }

.sp-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.sp-name-row {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.sp-tag {
  flex: none;
  font-size: 9px;
  font-weight: 700;
  line-height: 1.2;
  padding: 2px 5px;
  border-radius: 4px;
}
.sp-tag-conc { background: color-mix(in srgb, var(--accent-soft) 15%, transparent); color: var(--accent-soft); }
.sp-tag-ritual { background: color-mix(in srgb, var(--success) 13%, transparent); color: var(--success); }

.sp-name {
  min-width: 0;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-name-en {
  min-width: 0;
  color: var(--text-muted);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-meta {
  min-width: 0;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-grant {
  min-width: 0;
  color: var(--accent-soft);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-metrics {
  flex: none;
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.sp-save {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.sp-mul {
  color: var(--text-2);
  font-size: 13px;
  font-weight: 800;
}

.sp-step {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 12%, transparent);
  border-radius: 8px;
}
.sp-step-btn {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 5px;
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  color: var(--text-1);
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  padding: 0;
  transition: background 0.12s, color 0.12s;
}
.sp-step-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--accent) 28%, transparent); }
.sp-step-btn:disabled { opacity: 0.35; cursor: default; }
.sp-step-val {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  line-height: 1;
  min-width: 16px;
  color: var(--text-1);
  font-size: 14px;
  font-weight: 800;
}
.sp-step-val small {
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.sp-del {
  width: 30px;
  height: 30px;
  flex: none;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  transition: color 0.12s, background 0.12s;
}
.sp-del:hover { color: var(--danger); background: color-mix(in srgb, var(--danger) 10%, transparent); }

.sortable-placeholder {
  background: color-mix(in srgb, var(--accent) 8%, transparent) !important;
  outline: 2px dashed color-mix(in srgb, var(--accent) 50%, transparent);
  outline-offset: -2px;
}
.sortable-placeholder > * { visibility: hidden; }
</style>

<template>
  <div
    class="spell-row"
    :class="{
      'spell-row-clickable': !!entry.item,
      'spell-row-draggable': ctx.charCtx.ownerMode,
      'sortable-placeholder': ctx.sortable.isSource(entry),
    }"
    :data-sortable-key="entry.ref.id"
    @pointerdown="onRowDown"
    @click="onRowClick"
  >
    <div class="sp-lead">
      <button
        v-if="ctx.preparation"
        class="sp-prepared"
        :class="{ on: entry.ref.prepared }"
        :title="entry.ref.prepared ? 'В подготовленных' : 'Не подготовлено'"
        :aria-label="entry.ref.prepared ? 'Подготовлено' : 'Не подготовлено'"
        @click.stop="ctx.togglePrepared(entry.ref.id)"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" :fill="entry.ref.prepared ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
          <path d="M6.5 3.5h11a.5.5 0 0 1 .5.5v16l-6-3.6L6 20V4a.5.5 0 0 1 .5-.5z" />
        </svg>
      </button>

      <ItemIcon
        v-if="entry.item?.iconImageUrl"
        class="sp-item-icon"
        :item="entry.item"
        :fallback-to-type="false"
        :size="48"
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
        :attack="entry.item?.data?.damage?.range_attack ? ctx.formatBonus(ctx.attackBonus) : null"
        :damage-parts="damageParts"
        :modifier="damageModifier"
        :heal-parts="healParts"
        :rollable="true"
        @roll-attack="ctx.rollSpellAttack(entry)"
        @roll-damage="ctx.rollSpellDamage(entry, castLevel)"
        @roll-heal="ctx.rollSpellHeal(entry, castLevel)"
      />
    </div>

    <button v-if="ctx.charCtx.ownerMode" class="sp-del" title="Удалить заклинание" @click.stop="ctx.removeSpell(entry.ref.id)">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'

import AttackDamage from '@/features/character-editor/blocks/dnd/components/AttackDamage.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
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

// Drag the whole row to reorder; the sortable's 4px threshold keeps a plain tap a click. A drag flips
// `sortable.dragging` mid-gesture — we remember it so the trailing click doesn't open the spell modal.
let draggedThisGesture = false
watch(() => ctx.sortable.dragging, v => { if (v) draggedThisGesture = true })

function onRowDown(e) {
  if (e.target.closest('button')) return
  draggedThisGesture = false
  ctx.onSpellDragStart(e, props.entry, props.level, props.idx)
}
function onRowClick() {
  if (draggedThisGesture) { draggedThisGesture = false; return }
  ctx.openSpell(props.entry)
}
</script>

<style scoped>
.spell-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 60px;
  padding: 12px 4px;
  transition: background 0.12s;
  cursor: default;
}

.spell-row + .spell-row {
  border-top: 1px solid color-mix(in srgb, var(--text-on-accent) 7%, transparent);
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

.sp-prepared {
  width: 24px;
  height: 24px;
  flex: none;
  display: grid;
  place-items: center;
  border: none;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  transition: color 0.12s, transform 0.1s;
}
@media (hover: hover) {
  .sp-prepared:hover { color: var(--text-muted); }
  .sp-prepared.on:hover { color: var(--accent); }
}
.sp-prepared:active { transform: scale(0.88); }
.sp-prepared.on { color: var(--accent); }

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

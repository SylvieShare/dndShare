<template>
  <MorphTile :embedded="mode === 'panel'" :outlined="false" padding="0" edit-label="Редактировать"
      :title="title"
      :show-edit="showEdit"
      :edit-fade="editFade"
      @edit="$emit('edit')"
     class="stat-view" :class="{ 'stat-view--mobile': mobileVariant }">

    <!-- ── Head: name + edit pencil + save chip ── -->

      <template #aside>
        <div
          class="save-chip"
          role="button"
          tabindex="0"
          :aria-label="`${title} — спасбросок`"
          :aria-description="saveUp ? 'Владение' : undefined"
          aria-haspopup="menu"
          :aria-expanded="rollMenu?.kind === 'save'"
          @click.stop="openRollMenu($event, 'save')"
          @keydown.enter.prevent="openRollMenu($event, 'save')"
          @keydown.space.prevent="openRollMenu($event, 'save')"
        >
          <span class="save-label">Спасбросок</span>
          <span v-if="saveUp" class="proficiency-dot" aria-hidden="true"></span>
          <span class="save-chip-val">{{ signed(save) }}</span>
          <RollModeBadge :mode="saveMode" :source="saveModeSource" :cancelled="saveModeCancelled" />
        </div>
      </template>

    <!-- ── Modifier + raw value ── -->
    <div
      class="stat-body"
      role="button"
      tabindex="0"
      :aria-label="`${title} — проверка`"
      aria-haspopup="menu"
      :aria-expanded="rollMenu?.kind === 'stat'"
      @click.stop="openRollMenu($event, 'stat')"
      @keydown.enter.prevent="openRollMenu($event, 'stat')"
      @keydown.space.prevent="openRollMenu($event, 'stat')"
    >
      <SvgIcon v-if="suggestSvg" class="stat-icon" :svg="suggestSvg" color="var(--text-2)" />
      <span class="stat-mod" :style="{ color }">{{ signed(mod) }}</span>
      <span class="stat-raw">({{ raw }})</span>
      <RollModeBadge :mode="checkMode" :source="checkModeSource" :cancelled="checkModeCancelled" />
    </div>

    <!-- ── Skills ── -->
    <div v-if="skillsLoading || skills.length" class="skills" :aria-busy="skillsLoading">
      <template v-if="skillsLoading">
        <div v-for="index in skillSkeletonCount" :key="index" class="skill-item skill-skeleton">
          <SkeletonBlock width="60%" height="12px" />
          <SkeletonBlock width="38px" height="22px" />
        </div>
      </template>

      <div
        v-else
        v-for="skill in skills"
        :key="skill.id"
        class="skill-item"
        @mouseenter="showTooltip($event, skill)"
        @mouseleave="hideTooltip"
      >
        <span class="skill-label">
          <span class="skill-name">{{ skill.title }}</span>
          <span v-if="skill.up > 0" class="skill-proficiency" aria-hidden="true">
            <span class="proficiency-dot"></span>
            <span v-if="skill.up >= 2" class="proficiency-dot"></span>
          </span>
        </span>
        <RollModeBadge :mode="skill.rollMode" :source="skill.rollModeSource" :cancelled="skill.rollModeCancelled" />
        <span
          class="skill-chip"
          role="button"
          tabindex="0"
          :aria-label="`${skill.title} — проверка`"
          :aria-description="skill.up >= 2 ? 'Мастерство' : skill.up > 0 ? 'Владение' : undefined"
          aria-haspopup="menu"
          :aria-expanded="rollMenu?.kind === 'skill' && rollMenu?.id === skill.id"
          @click.stop="openRollMenu($event, 'skill', skill)"
          @keydown.enter.prevent="openRollMenu($event, 'skill', skill)"
          @keydown.space.prevent="openRollMenu($event, 'skill', skill)"
        >{{ signed(skill.bonus) }}</span>
      </div>
    </div>

    <DndStatRollMenu
      v-if="rollMenu"
      :key="`${rollMenu.kind}:${rollMenu.id || ''}`"
      :anchor="rollMenu.anchor"
      :scope="rollMenu.kind === 'save' ? 'saving_throw' : 'ability_check'"
      :title="rollMenu.title"
      :mode="rollMenu.mode"
      :cancelled="rollMenu.cancelled"
      @close="rollMenu = null"
      @roll="confirmRoll"
    />

    <ItemTooltip
      v-if="tooltip.visible"
      :title="tooltip.title"
      :desc="tooltip.desc"
      :x="tooltip.x"
      :top="tooltip.top"
      :bottom="tooltip.bottom"
      :max-desc="tooltipMaxDesc"
      :width="tooltipWidth"
    >
      <template #details>
        <div class="skill-tooltip-breakdown">
          <div v-for="row in tooltip.bonuses" :key="row.key" class="skill-tooltip-row">
            <span>{{ row.label }}</span>
            <strong>{{ signed(row.value) }}</strong>
          </div>
          <div class="skill-tooltip-row skill-tooltip-total">
            <span>Итого</span>
            <strong>{{ signed(tooltip.total) }}</strong>
          </div>
        </div>
      </template>
    </ItemTooltip>
  </MorphTile>
</template>

<script setup>
import { MorphTile, SkeletonBlock } from '@sylvieshare/share-ui'
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { signedOrZero as signed } from '@/shared/lib/dnd'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip'
import SvgIcon from '@/shared/ui/SvgIcon'
import DndStatRollMenu from './DndStatRollMenu.vue'
import RollModeBadge from '@/features/character-editor/blocks/dnd/components/RollModeBadge.vue'

const props = defineProps({
  title: { type: String, default: '' },
  color: { type: String, default: 'var(--text-muted)' },
  suggestSvg: { type: String, default: '' },
  mod: { type: Number, default: 0 },
  raw: { type: Number, default: 0 },
  save: { type: Number, default: 0 },
  saveUp: { type: Boolean, default: false },
  skills: { type: Array, default: () => [] },
  skillsLoading: { type: Boolean, default: false },
  skillSkeletonCount: { type: Number, default: 3 },
  tooltipMaxDesc: { type: Number, default: 0 },
  tooltipWidth: { type: Number, default: 420 },
  mobileVariant: { type: Boolean, default: false },
  mode: { type: String, default: 'tile' },   // 'tile' | 'panel'
  showEdit: { type: Boolean, default: true },
  editFade: { type: Boolean, default: false },  // fade the edit pencil out (driven by the morph `revealed`)
  checkMode: { type: String, default: 'normal' },
  checkModeSource: { type: String, default: '' },
  saveMode: { type: String, default: 'normal' },
  saveModeSource: { type: String, default: '' },
  checkModeCancelled: { type: Boolean, default: false },
  saveModeCancelled: { type: Boolean, default: false },
})
const emit = defineEmits(['edit', 'roll-stat', 'roll-save', 'roll-skill'])
const rollMenu = shallowRef(null)

function openRollMenu(event, kind, skill) {
  hideTooltip()
  if (rollMenu.value?.anchor === event.currentTarget) {
    rollMenu.value = null
    return
  }
  rollMenu.value = {
    anchor: event.currentTarget, kind, id: skill?.id,
    title: skill?.title || `${props.title} — ${kind === 'save' ? 'спасбросок' : 'проверка'}`,
    mode: skill?.rollMode || (kind === 'save' ? props.saveMode : props.checkMode),
    cancelled: skill?.rollModeCancelled ?? (kind === 'save' ? props.saveModeCancelled : props.checkModeCancelled),
  }
}

function confirmRoll(mode, excluded) {
  const selection = rollMenu.value
  rollMenu.value = null
  if (selection.kind === 'skill') emit('roll-skill', selection.id, mode, excluded)
  else emit(`roll-${selection.kind}`, mode, excluded)
}

const TOOLTIP_DELAY_MS = 450
const tooltip = ref({ visible: false, title: '', desc: '', bonuses: [], total: 0, x: 0, top: null, bottom: null })
let tooltipTimer = null

function showTooltip(event, skill) {
  hideTooltip()
  if (rollMenu.value) return
  const rect = event.currentTarget.getBoundingClientRect()
  const placeAbove = window.innerHeight - rect.bottom < 180
  tooltipTimer = window.setTimeout(() => {
    tooltip.value = {
      visible: true,
      title: skill.title,
      desc: skill.desc,
      bonuses: skill.bonusDetails || [],
      total: skill.bonus,
      x: Math.max(8, Math.min(rect.left, window.innerWidth - 380)),
      top: placeAbove ? null : rect.bottom + 8,
      bottom: placeAbove ? window.innerHeight - rect.top + 8 : null,
    }
    tooltipTimer = null
  }, TOOLTIP_DELAY_MS)
}
function hideTooltip() {
  if (tooltipTimer != null) window.clearTimeout(tooltipTimer)
  tooltipTimer = null
  tooltip.value.visible = false
}
onBeforeUnmount(hideTooltip)
</script>

<style scoped>
.stat-view {
  padding: var(--spacing-small) var(--spacing-medium) var(--spacing-medium);
  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}

.stat-icon { width: 26px; height: 26px; align-self: center; flex-shrink: 0; }

/* ── Save chip ── */
.save-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--surface-raised);
  border: 0;
  border-radius: 8px;
  padding: 3px 8px 3px 6px;
  user-select: none;
  cursor: pointer;
  transition: background-color 0.15s;
  flex-shrink: 0;
  box-sizing: border-box;
  min-height: var(--layout-sheet-value-height);
  min-width: calc(var(--layout-sheet-value-width) + 12px);
  justify-content: center;
}
@media (hover: hover) { .save-chip:hover { background: var(--surface-active); } }

.save-label {
  color: var(--text-2);
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  flex-shrink: 0;
}

.save-chip-val { color: var(--text-1); font-size: 13px; font-weight: 700; line-height: 1; }

/* ── Modifier ── */
.stat-body {
  display: flex;
  align-items: baseline;
  gap: 7px;
  cursor: pointer;
}

.stat-mod {
  font-family: var(--type-sheet-stat-family);
  font-variant-numeric: tabular-nums;
  font-size: var(--type-sheet-stat-size);
  font-weight: var(--type-sheet-stat-weight);
  line-height: 1;
  letter-spacing: var(--type-sheet-stat-tracking);
}

.stat-raw { color: var(--text-2); font-size: 15px; font-weight: 500; }

/* ── Skills ── */
.skills { display: flex; flex-direction: column; gap: 1px; margin-top: var(--spacing-small); }

.skill-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-block: 2px;
  border-radius: 7px;
  min-height: 26px;
}

.skill-skeleton { justify-content: space-between; pointer-events: none; }
.skill-label { display: flex; flex: 1; align-items: center; gap: var(--spacing-compact); min-width: 0; }
.skill-name {
  color: var(--text-1);
  font-size: 13px;
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.skill-proficiency { display: inline-flex; gap: var(--spacing-xs); flex: none; }
.proficiency-dot {
  width: var(--spacing-compact);
  height: var(--spacing-compact);
  flex: none;
  border-radius: 50%;
  background: var(--text-2);
}

.skill-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-height: var(--layout-sheet-value-height);
  background: var(--surface-raised);
  border: 0;
  border-radius: 7px;
  padding: 2px 7px 3px;
  color: var(--text-1);
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  min-width: var(--layout-sheet-value-width);
  text-align: center;
  line-height: 1.3;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
@media (hover: hover) { .skill-chip:hover { background: var(--surface-active); } }

.skill-tooltip-breakdown { display: grid; gap: 6px; width: min(100%, 340px); min-width: 0; margin-left: auto; }
.skill-tooltip-row { display: grid; grid-template-columns: minmax(0, 1fr) 3.25ch; align-items: baseline; column-gap: 12px; color: var(--text-muted); font-size: 11px; line-height: 1.25; }
.skill-tooltip-row span { min-width: 0; overflow-wrap: anywhere; text-align: right; }
.skill-tooltip-row strong { color: var(--text-1); font-size: 12px; font-variant-numeric: tabular-nums; text-align: right; }
.skill-tooltip-total { margin-top: 2px; padding-top: 6px; border-top: 1px solid var(--border); color: var(--text-1); font-weight: 700; }

/* ── Mobile variant ── */
.stat-view--mobile .skill-chip, .stat-view--mobile .save-chip { min-height: var(--layout-sheet-value-compact-height); }
.stat-view--mobile .skill-chip { min-width: var(--layout-sheet-value-compact-width); }
.stat-view--mobile .save-chip { min-width: calc(var(--layout-sheet-value-compact-width) + 12px); }
.stat-view--mobile .skill-item { min-height: 32px; border-radius: 10px; gap: 8px; }
.stat-view--mobile .skill-name { font-size: 15px; }
.stat-view--mobile .skill-chip { padding: 4px 10px 5px; font-size: 16px; border-radius: 9px; }
.stat-view--mobile .save-chip { padding: 5px 12px 5px 9px; gap: 7px; border-radius: 10px; }
.stat-view--mobile .save-chip-val { font-size: 15px; }
.stat-view--mobile .save-label { font-size: 13px; }
.stat-view--mobile .stat-mod { font-size: var(--type-sheet-stat-compact-size); letter-spacing: var(--type-sheet-stat-compact-tracking); }
.stat-view--mobile .stat-raw { font-size: 18px; }
.stat-view--mobile .stat-icon { width: 32px; height: 32px; }
.stat-view--mobile .skills { gap: 2px; }

</style>

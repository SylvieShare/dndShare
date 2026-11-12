<template>
  <MorphTile :embedded="mode === 'panel'" :outlined="false" padding="0" edit-label="Редактировать"
      :title="title"
      :show-edit="showEdit"
      :show-edit-icon="false"
      :edit-fade="editFade"
      @edit="$emit('edit')"
     class="stat-view" :class="{ 'stat-view--mobile': mobileVariant }">
    <template #decoration><TileAccentStrip v-if="mode !== 'panel'" :color="color" /></template>

    <!-- ── Head: editable name + save chip ── -->

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
          <StatRollValue :mode="saveMode" :source="saveModeSource" :cancelled="saveModeCancelled" :active="rollMenu?.kind === 'save'">
            <span class="save-number">
              <span class="save-label">Спас</span>
              <span v-if="saveUp" class="proficiency-dot" aria-hidden="true"></span>
              <span class="save-chip-val">{{ signed(save) }}</span>
            </span>
          </StatRollValue>
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
      <SvgIcon v-if="suggestSvg || suggestSvgId" class="stat-icon" :svg="suggestSvg" :svg-id="suggestSvgId" :color="color" />
      <StatRollValue primary :mode="checkMode" :source="checkModeSource" :cancelled="checkModeCancelled" :active="rollMenu?.kind === 'stat'">
        <span class="stat-number">
          <span class="stat-mod" :style="{ color }">{{ signed(mod) }}</span>
          <span class="stat-raw">({{ raw }})</span>
        </span>
      </StatRollValue>
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
        >
          <StatRollValue :mode="skill.rollMode" :source="skill.rollModeSource" :cancelled="skill.rollModeCancelled" :active="rollMenu?.kind === 'skill' && rollMenu?.id === skill.id">
            <span class="skill-chip-val">{{ signed(skill.bonus) }}</span>
          </StatRollValue>
        </span>
      </div>
    </div>

    <DndStatRollMenu
      v-if="rollMenu"
      :key="`${rollMenu.kind}:${rollMenu.id || ''}`"
      :anchor="rollMenu.anchor"
      :color="color"
      :scope="rollMenu.kind === 'save' ? 'saving_throw' : 'ability_check'"
      :title="rollMenu.title" :total="rollMenu.total" :details="rollMenu.details"
      :editable="showEdit && mode !== 'panel'" @edit="editSelection"
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
import { MorphTile, SkeletonBlock, TileAccentStrip } from '@sylvieshare/share-ui'
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { formatBonus as signed } from '@/shared/lib/dnd'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip'
import SvgIcon from '@/shared/ui/SvgIcon'
import DndStatRollMenu from './DndStatRollMenu.vue'
import StatRollValue from './StatRollValue.vue'

const props = defineProps({
  title: { type: String, default: '' },
  color: { type: String, default: 'var(--text-muted)' },
  suggestSvg: { type: String, default: '' },
  suggestSvgId: { type: [Number, String], default: null },
  checkTotal: Number,
  proficiencyBonus: { type: Number, default: 0 },
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
  const anchor = event.currentTarget
  if (rollMenu.value?.anchor === anchor) {
    rollMenu.value = null
    return
  }
  rollMenu.value = {
    anchor, kind, id: skill?.id,
    title: skill?.title || `${props.title} — ${kind === 'save' ? 'спасбросок' : 'проверка'}`,
    total: skill?.bonus ?? (kind === 'save' ? props.save : props.checkTotal ?? props.mod),
    details: skill?.bonusDetails || basicDetails(kind),
    mode: skill?.rollMode || (kind === 'save' ? props.saveMode : props.checkMode),
    cancelled: skill?.rollModeCancelled ?? (kind === 'save' ? props.saveModeCancelled : props.checkModeCancelled),
  }
}

function basicDetails(kind) {
  const total = kind === 'save' ? props.save : props.checkTotal ?? props.mod
  const proficiency = kind === 'save' && props.saveUp ? props.proficiencyBonus : 0
  return [
    { key: 'ability', label: `Модификатор: ${props.title}`, value: props.mod },
    ...(proficiency ? [{ key: 'proficiency', label: 'Владение', value: proficiency }] : []),
    ...(total !== props.mod + proficiency ? [{ key: 'extra', label: 'Дополнительные бонусы', value: total - props.mod - proficiency }] : []),
  ]
}
function editSelection() {
  const { kind, id } = rollMenu.value
  rollMenu.value = null
  emit('edit', kind, id)
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

<style scoped src="./DndStatView.css" />

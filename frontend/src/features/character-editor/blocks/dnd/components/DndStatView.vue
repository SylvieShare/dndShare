<template>
  <div class="stat-view" :class="{ 'stat-view--mobile': mobileVariant, 'stat-view--panel': mode === 'panel' }" :style="{ '--sc': color }">

    <!-- ── Head: name + edit pencil + save chip ── -->
    <SheetBlockTitle
      class="stat-card-head"
      :title="title"
      :show-edit="showEdit"
      :edit-fade="editFade"
      @edit="$emit('edit')"
    >
      <template #aside>
        <div
          class="save-chip"
          :class="{ 'save-chip-active': saveUp }"
          @click.stop="$emit('roll-save')"
        >
          <span class="save-shield-icon"></span>
          <span class="save-chip-val">{{ signed(save) }}</span>
        </div>
      </template>
    </SheetBlockTitle>

    <!-- ── Modifier + raw value ── -->
    <div class="stat-body" @click.stop="$emit('roll-stat')">
      <SvgIcon v-if="suggestSvg" class="stat-icon" :svg="suggestSvg" :color="color" />
      <span class="stat-mod">{{ signed(mod) }}</span>
      <span class="stat-raw">({{ raw }})</span>
    </div>

    <!-- ── Skills ── -->
    <div class="skills">
      <template v-if="skillsLoading">
        <div v-for="index in skillSkeletonCount" :key="index" class="skill-item skill-skeleton">
          <span class="skill-skeleton-dot"></span>
          <span class="skill-skeleton-name"></span>
          <span class="skill-skeleton-bonus"></span>
        </div>
      </template>

      <div
        v-else
        v-for="skill in skills"
        :key="skill.id"
        class="skill-item"
      >
        <span
          class="skill-name"
          :class="{ 'skill-name-prof': skill.up > 0 }"
          @mouseenter="showTooltip($event, skill)"
          @mouseleave="hideTooltip"
        >{{ skill.title }}</span>
        <span class="skill-line"></span>
        <span
          class="skill-chip"
          :class="{ 'skill-chip-active': skill.up > 0, 'skill-chip-master': skill.up >= 2 }"
          @click.stop="$emit('roll-skill', skill.id)"
        >{{ signed(skill.bonus) }}</span>
      </div>
    </div>

    <ItemTooltip
      v-if="tooltip.visible"
      :title="tooltip.title"
      :desc="tooltip.desc"
      :x="tooltip.x"
      :top="tooltip.top"
      :bottom="tooltip.bottom"
      :max-desc="tooltipMaxDesc"
      :width="tooltipWidth"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { signedOrZero as signed } from '@/shared/lib/dnd'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip'
import SheetBlockTitle from '@/shared/ui/SheetBlockTitle'
import SvgIcon from '@/shared/ui/SvgIcon'

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
})
defineEmits(['edit', 'roll-stat', 'roll-save', 'roll-skill'])

const tooltip = ref({ visible: false, title: '', desc: '', x: 0, top: null, bottom: null })

function showTooltip(event, skill) {
  if (!skill.desc) return
  const rect = event.currentTarget.getBoundingClientRect()
  const placeAbove = window.innerHeight - rect.bottom < 180
  tooltip.value = {
    visible: true,
    title: skill.title,
    desc: skill.desc,
    x: Math.max(8, Math.min(rect.left, window.innerWidth - 380)),
    top: placeAbove ? null : rect.bottom + 8,
    bottom: placeAbove ? window.innerHeight - rect.top + 8 : null,
  }
}
function hideTooltip() { tooltip.value.visible = false }
</script>

<style scoped>
.stat-view {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}

/* ── Head ── */
.stat-card-head { margin-bottom: 2px; }

.stat-icon { width: 26px; height: 26px; align-self: center; flex-shrink: 0; }

/* ── Save chip ── */
.save-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 3px 8px 3px 6px;
  user-select: none;
  cursor: pointer;
  transition: border-color 0.15s;
  flex-shrink: 0;
}
@media (hover: hover) { .save-chip:hover { border-color: var(--border-strong); } }
.save-chip-active { border-color: var(--sc, var(--accent)); }

.save-shield-icon {
  width: 13px;
  height: 13px;
  background-color: var(--text-muted);
  mask: url("/static/shield.svg") center / contain no-repeat;
  -webkit-mask: url("/static/shield.svg") center / contain no-repeat;
  flex-shrink: 0;
  transition: background-color 0.15s;
}
.save-chip-active .save-shield-icon { background-color: var(--sc, var(--accent)); }

.save-chip-val { color: var(--text-1); font-size: 13px; font-weight: 700; line-height: 1; }

/* ── Modifier ── */
.stat-body {
  display: flex;
  align-items: baseline;
  gap: 7px;
  margin-bottom: 10px;
  cursor: pointer;
}
.stat-body:hover .stat-mod { color: var(--accent); }

.stat-mod {
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  font-size: 26px;
  font-weight: 700;
  color: var(--sc, var(--text-1));
  line-height: 1;
  letter-spacing: -0.02em;
}

.stat-raw { color: var(--text-2); font-size: 15px; font-weight: 500; }

/* ── Skills ── */
.skills { display: flex; flex-direction: column; gap: 1px; }

.skill-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 3px;
  border-radius: 7px;
  min-height: 26px;
}

.skill-skeleton { pointer-events: none; }
.skill-skeleton-dot,
.skill-skeleton-name,
.skill-skeleton-bonus {
  display: block;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--surface), var(--surface-raised), var(--surface));
  background-size: 180% 100%;
  animation: skill-loading 1.1s ease-in-out infinite;
}
.skill-skeleton-dot { width: 8px; height: 8px; flex-shrink: 0; }
.skill-skeleton-name { height: 10px; flex: 1; }
.skill-skeleton-bonus { width: 38px; height: 22px; border-radius: 7px; flex-shrink: 0; }
@keyframes skill-loading {
  0% { background-position: 120% 0; }
  100% { background-position: -80% 0; }
}

.skill-name {
  color: var(--text-2);
  font-size: 13px;
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.skill-name-prof { color: var(--text-1); }

.skill-line {
  flex: 1;
  border-bottom: 1px dotted var(--border);
  align-self: flex-end;
  margin: 0 2px 5px;
  min-width: 8px;
}

.skill-chip {
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 2px 7px 3px;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
  min-width: 36px;
  text-align: center;
  line-height: 1.3;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.skill-chip-active { color: var(--text-1); border-color: color-mix(in srgb, var(--sc, var(--accent)) 50%, transparent); }
.skill-chip-master { border-width: 2px; border-color: color-mix(in srgb, var(--sc, var(--accent)) 75%, transparent); }
@media (hover: hover) { .skill-chip:hover { border-color: var(--accent); background: var(--surface-active); } }

/* ── Mobile variant ── */
.stat-view--mobile .skill-item { min-height: 32px; padding: 2px 4px; border-radius: 10px; gap: 8px; }
.stat-view--mobile .skill-name { font-size: 15px; }
.stat-view--mobile .skill-line { margin-bottom: 6px; }
.stat-view--mobile .skill-chip { padding: 4px 10px 5px; font-size: 16px; border-radius: 9px; }
.stat-view--mobile .save-chip { padding: 5px 12px 5px 9px; gap: 7px; border-radius: 10px; }
.stat-view--mobile .save-chip-val { font-size: 15px; }
.stat-view--mobile .save-shield-icon { width: 16px; height: 16px; }
.stat-view--mobile .stat-mod { font-size: 44px; }
.stat-view--mobile .stat-raw { font-size: 18px; }
.stat-view--mobile .stat-name { font-size: 12px; }
.stat-view--mobile .stat-icon { width: 32px; height: 32px; }
.stat-view--mobile .skills { gap: 2px; }

/* ── Panel (morph left column): identical to the tile so the morph has no content shift.
   The tile's padding comes from BaseTile (.stat-block); the panel has no BaseTile wrapper,
   so it reproduces that padding here. ── */
.stat-view--panel { padding: 12px 14px 14px; }
</style>

<template>
  <div class="stf" :style="{ '--sc': color }">
    <SheetBlockTitle
      class="stf-head"
      :title="label"
      :show-edit="showEdit"
      :edit-fade="editFade"
      @edit="$emit('edit')"
    />
    <div class="stf-body" @click.stop="$emit('open')">
      <span v-if="icon" class="stf-ic" :style="iconStyle" aria-hidden="true"></span>
      <div class="stf-val">
        <span v-if="pre" class="stf-pre">{{ pre }}</span>
        <span class="stf-num">{{ value }}</span>
        <span v-if="unit" class="stf-unit">{{ unit }}</span>
      </div>
      <button v-if="rollable" class="stf-roll" type="button" title="Бросить кубик" @click.stop="$emit('roll')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 1.2l5.6 3.2v7.2L8 14.8 2.4 11.6V4.4L8 1.2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
          <circle cx="8" cy="8" r="1.1" fill="currentColor" />
          <circle cx="5.4" cy="6.2" r="0.8" fill="currentColor" />
          <circle cx="10.6" cy="9.8" r="0.8" fill="currentColor" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SheetBlockTitle from '@/shared/ui/SheetBlockTitle'

// Uniform face for the desktop utility tiles (AC / initiative / speed / prof-bonus). Rendered both
// as the tile (inside BaseTile) and as the morph window's left column, so the two look identical.
// The title carries an edit pencil that emits `edit`; clicking the value body emits `open` — both open
// the morph editor. Tiles flagged `rollable` show a dice button on the right that emits `roll`.
const props = defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  pre: { type: String, default: '' },     // e.g. '+'
  unit: { type: String, default: '' },    // e.g. 'фт'
  icon: { type: String, default: '' },    // svg url (static file)
  rollable: { type: Boolean, default: false },  // show the dice button on the right
  color: { type: String, default: 'var(--accent)' },
  showEdit: { type: Boolean, default: false },  // stat tiles open the editor by tapping anywhere — no pencil
  editFade: { type: Boolean, default: false },  // fade the pencil out as the morph opens (driven by `revealed`)
})
defineEmits(['edit', 'open', 'roll'])
// Recolor the (static-URL) svg via mask + background-color — the icon takes the title's muted colour
// by default (not the accent), so resting tiles stay neutral.
const iconStyle = computed(() => ({
  maskImage: `url("${props.icon}")`,
  webkitMaskImage: `url("${props.icon}")`,
  backgroundColor: 'var(--text-muted)',
}))
</script>

<style scoped>
.stf {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 6px;
  height: 80px;
  padding: 10px 12px;
  user-select: none;
  box-sizing: border-box;
  min-width: 0;
}
.stf-head { flex-shrink: 0; min-width: 0; }
/* compact label so "Бонус умения" + the pencil fit the narrow stat tile on one line (no truncation) */
.stf-head :deep(.sbt-title) { font-size: 9px; letter-spacing: 0.04em; }
.stf-head :deep(.sbt-edit) { width: 18px; height: 18px; }
/* tint the pencil with the tile colour (SheetBlockTitle defaults to --accent) */
.stf-head :deep(.sbt-main--clickable:hover .sbt-edit),
.stf-head :deep(.sbt-edit:hover) { color: var(--sc, var(--accent)); }
.stf-body { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.stf-ic {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  opacity: 0.9;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
}
.stf-roll {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  margin-left: auto;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--sc, var(--accent));
  cursor: pointer;
  transition: color 0.12s, background 0.12s;
}
@media (hover: hover) {
  .stf-roll:hover { background: rgba(255, 255, 255, 0.06); }
}
.stf-val { display: flex; align-items: baseline; gap: 2px; }
.stf-pre { font-size: 16px; font-weight: 400; color: var(--text-2); line-height: 1; }
.stf-num { font-size: 22px; font-weight: 400; color: var(--text-1); line-height: 1; }
.stf-unit { font-size: 13px; font-weight: 500; color: var(--text-muted); line-height: 1; }
</style>

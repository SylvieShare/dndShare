<template>
  <component :is="cell ? UtilityCell : MorphTile" v-bind="faceProps" :style="{ '--sc': color }" @edit="emit('edit')" @click="onFaceClick">
    <template #decoration><slot name="decoration" /></template>

    <MorphTileHeader v-if="cell" class="stf-cell-heading" compact-header :title="label" />
    <span class="stf-body" @click="onBodyClick">
      <span v-if="icon" class="stf-ic" :style="iconStyle" aria-hidden="true"></span>
      <span class="stf-val">
        <span v-if="pre" class="stf-pre">{{ pre }}</span>
        <span class="stf-num">{{ value }}</span>
        <span v-if="unit" class="stf-unit">{{ unit }}</span>
      </span>
      <button v-if="rollable && !cell" class="stf-roll" type="button" title="Бросить кубик" @click.stop="emit('roll')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 1.2l5.6 3.2v7.2L8 14.8 2.4 11.6V4.4L8 1.2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
          <circle cx="8" cy="8" r="1.1" fill="currentColor" />
          <circle cx="5.4" cy="6.2" r="0.8" fill="currentColor" />
          <circle cx="10.6" cy="9.8" r="0.8" fill="currentColor" />
        </svg>
      </button>
    </span>
  </component>
</template>

<script setup>
import { computed } from 'vue'
import { MorphTile, MorphTileHeader } from '@sylvieshare/share-ui'
import UtilityCell from '@/features/character-editor/components/UtilityCell.vue'

// Grouped desktop metrics use a single button for their whole cell; standalone tiles and
// morph previews retain the shared heading and value face.
const props = defineProps({
  panel: Boolean,
  embedded: Boolean,
  interactive: { type: Boolean, default: true },
  active: Boolean,
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
const emit = defineEmits(['edit', 'open', 'roll'])
const cell = computed(() => props.embedded && !props.panel)
const faceProps = computed(() => cell.value
  ? { label: props.label, stacked: true, disabled: !props.interactive, active: props.active }
  : { class: 'stf', compactHeader: true, embedded: props.panel, color: props.color, padding: '0',
      editLabel: 'Редактировать', title: props.label, showEdit: props.showEdit, editFade: props.editFade })

function onFaceClick(event) { if (cell.value) emit('open', event) }
function onBodyClick(event) {
  if (cell.value) return
  event.stopPropagation()
  emit('open', event)
}
// Recolor the (static-URL) svg via mask + background-color — the icon takes the title's muted colour
// by default (not the accent), so resting tiles stay neutral.
const iconStyle = computed(() => ({
  maskImage: `url("${props.icon}")`,
  webkitMaskImage: `url("${props.icon}")`,
  backgroundColor: 'var(--text-muted)',
}))
</script>

<style scoped>
.stf-cell-heading { pointer-events: none; }
.stf {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 4px;
  min-height: 64px;
  height: 100%;
  padding: 6px 10px;
  user-select: none;
  box-sizing: border-box;
  min-width: 0;
}
.stf-body { display: flex; align-items: center; gap: 4px; cursor: pointer; }
.stf-ic {
  width: 20px;
  height: 20px;
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
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--sc, var(--accent));
  cursor: pointer;
  transition: color 0.12s, background 0.12s;
}
@media (hover: hover) {
  .stf-roll:hover { background: color-mix(in srgb, var(--text-on-accent) 6%, transparent); }
}
.stf-val { display: flex; align-items: baseline; gap: 2px; }
.stf-pre { font-size: 16px; font-weight: 400; color: var(--text-2); line-height: 1; }
.stf-num { font-size: 22px; font-weight: 400; color: var(--text-1); line-height: 1; }
.stf-unit { font-size: 13px; font-weight: 500; color: var(--text-muted); line-height: 1; }
</style>

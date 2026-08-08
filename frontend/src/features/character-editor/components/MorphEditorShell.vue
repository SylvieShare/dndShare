<script setup>
// Generalized two-column morph editor used by every sheet block that edits in-place (the stat block
// and the AC/initiative/speed/prof-bonus tiles). Wraps MorphSheet and lays out:
//   left = `view` slot (a stand-in for the tapped tile) with a colored strip,
//   right = `editor` slot (the form), behind a divider, which fades in/out over the morph.
// Optional `nav` (useSheetSubpages) enables a `sub` slot (e.g. per-skill editing).
import { computed } from 'vue'
import MorphSheet from '@/shared/ui/MorphSheet'

const props = defineProps({
  originRect: { type: Object, default: null },
  originEl: { type: Object, default: null },
  originRadius: { type: String, default: 'var(--r-lg)' },
  color: { type: String, default: 'var(--accent)' },   // strip color + --sc for the view slot
  editorWidth: { type: Number, default: 360 },          // width of the revealed editor column (horizontal)
  minViewWidth: { type: Number, default: 0 },           // floor for the view (tiny origins)
  orientation: { type: String, default: 'horizontal' }, // 'horizontal' (editor right) | 'vertical' (editor below)
  strip: { type: Boolean, default: true },
  frame: { type: String, default: '' },                 // gradient + colored border on the panel (block "unfolds" into the window)
  nav: { type: Object, default: null },
})
defineEmits(['close'])

const vertical = computed(() => props.orientation === 'vertical')
const leftWidth = computed(() => {
  const w = props.originRect ? Math.round(props.originRect.width) : 280
  return Math.max(w, props.minViewWidth)
})
const panelWidth = computed(() => {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  // vertical: editor stacks under the view → panel keeps the view width; horizontal: grows rightward
  const target = vertical.value ? leftWidth.value : leftWidth.value + props.editorWidth
  return Math.min(target, vw - 32)
})
const showBack = computed(() => !!props.nav && props.nav.view.value !== 'detail')
</script>

<template>
  <MorphSheet
    :origin-rect="originRect"
    :origin-el="originEl"
    :origin-radius="originRadius"
    :width="panelWidth"
    :nav="nav"
    :show-back="showBack"
    :frame-color="frame"
    @close="$emit('close')"
  >
    <template #detail="{ revealed }">
      <div class="mes-split" :class="{ 'mes-vertical': vertical }" :style="{ '--tile-w': leftWidth + 'px', '--tile-h': (originRect?.height || 0) + 'px', '--sc': color }">
        <div class="mes-view" :class="{ 'mes-revealed': revealed }">
          <div class="mes-view-body">
            <span v-if="strip" class="mes-strip"></span>
            <slot name="view" :revealed="revealed" />
          </div>
        </div>
        <div class="mes-rest" :class="{ 'mes-revealed': revealed }">
          <div class="mes-editor"><slot name="editor" /></div>
        </div>
      </div>
    </template>

    <template v-if="nav" #sub><slot name="sub" /></template>
  </MorphSheet>
</template>

<style scoped>
.mes-split { display: flex; align-items: stretch; position: relative; }
.mes-view { flex: 0 0 var(--tile-w, 280px); align-self: flex-start; }
.mes-view-body { position: relative; box-sizing: border-box; }
.mes-split:not(.mes-vertical) .mes-view-body { min-height: var(--tile-h); }
.mes-strip {
  /* Match BaseTile's strip insets (var(--r-lg)) exactly: at the open-start / close-end swap between
     the static tile's `.base-tile-strip` and this one, a different inset would snap the strip height. */
  position: absolute;
  top: var(--r-lg);
  bottom: var(--r-lg);
  left: 0;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: var(--sc, var(--accent));
}
.mes-rest {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
  background: var(--bg);
  opacity: 0;
  transition: opacity 0.42s ease;
}
.mes-rest.mes-revealed { opacity: 1; }
.mes-editor { flex: 1; min-width: 0; }

/* Horizontal morph keeps the view column layout-identical to the source tile.
   Do not animate margin/padding here: changing scrollHeight during the FLIP makes tall stat
   blocks recalculate the body height mid-morph. */

/* vertical: editor stacks under the view, divider is a horizontal line */
.mes-split.mes-vertical { flex-direction: column; }
.mes-vertical .mes-view { flex: none; width: 100%; }
.mes-vertical .mes-rest { flex: none; width: 100%; flex-direction: column; }

@media (max-width: 768px) {
  .mes-split { flex-direction: column; }
  .mes-view { flex: none; width: 100%; }
  .mes-rest { flex: none; width: 100%; flex-direction: column; }
}
</style>

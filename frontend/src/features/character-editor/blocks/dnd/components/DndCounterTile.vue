<template>
  <DndCounterTileView v-bind="$attrs"
    ref="tileEl"
    class="dct"
    :class="{ 'sortable-placeholder': ctx.sortable.isSource(counter), 'dct--draggable': ctx.ownerMode }"
    :data-sortable-key="counter.id"
    @pointerdown="onDown"
    @pointerup="onUp"
    :counter="counter"
    :manage="ctx.ownerMode"
    interactive
    @edit="openEditor"
    @inc="ctx.adjust(counter.id, 1)"
    @dec="ctx.adjust(counter.id, -1)"
  />

  <MorphEditorShell
    v-if="editorOpen"
    :origin-rect="originRect"
    :origin-el="originEl"
    :strip="false"
    :min-view-width="320"
    @close="close"
  >
    <template #view>
      <DndCounterTileView panel :counter="counter" :manage="ctx.ownerMode" :interactive="false" />
    </template>
    <template #editor>
      <DndCounterEditor
        :counter="counter"
        @update="p => ctx.update(counter.id, p)"
        @remove="onRemove"
        @close="close"
      />
    </template>
  </MorphEditorShell>
</template>

<script setup>
import { inject, ref } from 'vue'
import DndCounterEditor from '@/features/character-editor/blocks/dnd/components/DndCounterEditor.vue'
import DndCounterTileView from '@/features/character-editor/blocks/dnd/components/DndCounterTileView.vue'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'

defineOptions({ inheritAttrs: false })
const props = defineProps({
  counter: { type: Object, required: true },
  index: { type: Number, required: true },
})

const ctx = inject('countersBlockCtx')
const tileEl = ref(null)
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()

let downX = 0
let downY = 0

function openEditor() { openFrom(tileEl.value?.$el) }

function onDown(e) {
  downX = e.clientX
  downY = e.clientY
  if (e.target.closest('button') || e.target.closest('input')) return
  if (!ctx.ownerMode) return
  ctx.onDragStart(e, props.counter, props.index)
}

function onUp(e) {
  if (e.target.closest('button') || e.target.closest('input')) return
  if (Math.hypot(e.clientX - downX, e.clientY - downY) >= 4) return
  if (ctx.ownerMode) openEditor()
}

function onRemove() {
  close()
  ctx.remove(props.counter.id)
}
</script>

<style scoped>
.dct {
  position: relative;
  min-width: 112px;
  border-radius: 10px;
  transition: background 0.12s;
}
.dct--draggable { cursor: pointer; touch-action: pan-y; }
.dct--draggable:active { cursor: grabbing; }
@media (hover: hover) {
  .dct--draggable:hover { background: color-mix(in srgb, var(--text-on-accent) 4%, transparent); }
}

.dct.sortable-placeholder {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  outline: 2px dashed color-mix(in srgb, var(--accent) 50%, transparent);
  outline-offset: -2px;
}
.dct.sortable-placeholder > * { visibility: hidden; }


</style>

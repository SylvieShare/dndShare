<template>
  <div
    ref="tileEl"
    class="dct"
    :class="{ 'sortable-placeholder': ctx.sortable.isSource(counter), 'dct--draggable': ctx.ownerMode }"
    :data-sortable-key="counter.id"
    @pointerdown="onDown"
  >
    <DndCounterTileView
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
      orientation="vertical"
      :min-view-width="320"
      @close="close"
    >
      <template #view="{ revealed }">
        <div class="dct-morph">
          <DndCounterTileView :counter="counter" :manage="ctx.ownerMode" :interactive="false" :edit-fade="revealed" />
        </div>
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
  </div>
</template>

<script setup>
import { inject, onMounted, ref } from 'vue'
import DndCounterEditor from '@/features/character-editor/blocks/dnd/components/DndCounterEditor.vue'
import DndCounterTileView from '@/features/character-editor/blocks/dnd/components/DndCounterTileView.vue'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'

const props = defineProps({
  counter: { type: Object, required: true },
  index: { type: Number, required: true },
})

const ctx = inject('countersBlockCtx')
const tileEl = ref(null)
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()

function openEditor() { openFrom(tileEl.value) }

function onDown(e) {
  if (e.target.closest('button') || e.target.closest('input')) return
  if (!ctx.ownerMode) return
  ctx.onDragStart(e, props.counter, props.index)
}

function onRemove() {
  close()
  ctx.remove(props.counter.id)
}

onMounted(() => {
  // A freshly added tile opens its editor straight away so name/icon can be set without a second tap.
  if (ctx.justAddedId === props.counter.id) {
    ctx.clearJustAdded()
    openEditor()
  }
})
</script>

<style scoped>
.dct {
  position: relative;
  min-width: 112px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, #fff 2%, var(--block-bg));
  transition: border-color 0.12s, background 0.12s;
}
.dct--draggable { cursor: grab; touch-action: pan-y; }
.dct--draggable:active { cursor: grabbing; }
@media (hover: hover) {
  .dct--draggable:hover { border-color: var(--border-strong); }
}

.dct.sortable-placeholder {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  outline: 2px dashed color-mix(in srgb, var(--accent) 50%, transparent);
  outline-offset: -2px;
}
.dct.sortable-placeholder > * { visibility: hidden; }

/* morph window header — wraps the shared view so it morphs cleanly into the window. No border here;
   the morph panel is the surface. The view owns its own padding so geometry matches the tile. */
.dct-morph { min-width: 0; }
</style>

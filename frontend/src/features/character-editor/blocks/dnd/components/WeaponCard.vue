<template>
  <div
    ref="cardEl"
    class="w-card"
    :class="{ 'sortable-placeholder': ctx.sortable.isSource(entry) }"
    :data-sortable-key="entry._key"
  >
    <WeaponCardView
      :entry="entry"
      interactive
      @name-down="onNameDown"
      @name-click="onNameClick"
      @edit="openEditor"
      @roll-attack="ctx.rollAttack(entry)"
      @roll-damage="ctx.rollDamage(entry)"
      @roll-damage-two="ctx.rollDamageTwoHanded(entry)"
    />

    <RichContent v-if="entry.desc" class="w-desc-text" :html="entry.desc" />

    <MorphEditorShell
      v-if="editorOpen"
      :origin-rect="originRect"
      :origin-el="originEl"
      :strip="false"
      orientation="vertical"
      :min-view-width="440"
      @close="close"
    >
      <template #view="{ revealed }">
        <div class="w-morph-row">
          <WeaponCardView :entry="entry" :revealed="revealed" />
        </div>
      </template>
      <template #editor>
        <WeaponEditor :entry="entry" :index="index" @close="close" />
      </template>
    </MorphEditorShell>
  </div>
</template>

<script setup>
import { inject, ref, watch } from 'vue'
import RichContent from '@/shared/ui/RichContent'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import WeaponCardView from '@/features/character-editor/blocks/dnd/components/WeaponCardView.vue'
import WeaponEditor from '@/features/character-editor/blocks/dnd/components/WeaponEditor.vue'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'

const props = defineProps({
  entry: { type: Object, required: true },
  index: { type: Number, required: true },
})

const ctx = inject('weaponsBlockCtx')
const cardEl = ref(null)
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()

// reorder by dragging the name; the sortable's 4px threshold keeps a plain click a click. A drag
// flips `sortable.dragging` mid-gesture — we remember it so the trailing click doesn't open the editor.
let draggedThisGesture = false
watch(() => ctx.sortable.dragging, v => { if (v) draggedThisGesture = true })

function openEditor() { openFrom(cardEl.value) }
function onNameDown(e) {
  draggedThisGesture = false
  if (ctx.charCtx.ownerMode) ctx.onDragStart(e, props.entry, props.index)
}
function onNameClick() {
  if (draggedThisGesture) { draggedThisGesture = false; return }
  if (ctx.charCtx.ownerMode) { openEditor(); return }
  if (ctx.item(props.entry)) ctx.openItemModal(props.entry.item_id)
}
</script>

<style scoped>
/* No card backing — the block sits on the tab tile; entries are split by a divider. */
.w-card {
  position: relative;
  padding-left: 16px;
  border-bottom: 1px solid rgba(140, 140, 154, 0.18);
  transition: background 0.12s;
}
.w-card:last-child { border-bottom: none; }

.w-card.sortable-placeholder {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border: 2px dashed color-mix(in srgb, var(--accent) 50%, transparent);
  border-radius: 8px;
}
.w-card.sortable-placeholder > * { visibility: hidden; }

.w-desc-text {
  padding: 0 20px 14px 16px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.45;
}

/* morph window header — wraps the shared row so it morphs cleanly into the window. The left padding
   matches `.w-card` so the icon stays flush; the row's own padding lives inside WeaponCardView. */
.w-morph-row { padding: 0 0 0 16px; }
</style>

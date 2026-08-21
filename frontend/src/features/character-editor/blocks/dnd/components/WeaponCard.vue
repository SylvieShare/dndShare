<template>
  <RowActionMenu
    block
    :title="`Действия: ${ctx.itemTitle(entry)}`"
    :disabled="draggedThisGesture || (!ctx.charCtx.ownerMode && !ctx.item(entry))"
  >
    <template #trigger>
      <BaseTile
        ref="cardEl"
        class="w-card"
        :class="{ 'sortable-placeholder': ctx.sortable.isSource(entry) }"
        :data-sortable-key="entry._key"
        @pointerdown="draggedThisGesture = false"
      >
        <WeaponCardView
          :entry="entry"
          interactive
          @name-down="onNameDown"
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
          <template #view>
            <div class="w-morph-row">
              <WeaponCardView :entry="entry" />
            </div>
          </template>
          <template #editor>
            <WeaponEditor :entry="entry" :index="index" @close="close" />
          </template>
        </MorphEditorShell>
      </BaseTile>
    </template>

    <template #default="{ close: closeMenu }">
      <RowActionItem
        v-if="ctx.item(entry)"
        action="view"
        @click="openDescription(closeMenu)"
      >Открыть описание</RowActionItem>
      <RowActionItem
        v-if="ctx.charCtx.ownerMode"
        action="edit"
        @click="editWeapon(closeMenu)"
      >Редактировать</RowActionItem>
      <RowActionItem
        v-if="ctx.canMoveWeaponToItems(entry)"
        :icon="ArrowRightLeft"
        tone="info"
        @click="moveToItems(closeMenu)"
      >Переместить в вещи</RowActionItem>
      <RowActionItem
        v-if="ctx.charCtx.ownerMode"
        action="delete"
        tone="danger"
        @click="deleteWeapon(closeMenu)"
      >Удалить</RowActionItem>
    </template>
  </RowActionMenu>
</template>

<script setup>
import { ArrowRightLeft } from '@lucide/vue'
import { inject, ref, watch } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import { RowActionMenu } from '@sylvieshare/share-ui'
import RichContent from '@/shared/ui/DndRichContent.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
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
// flips `sortable.dragging` mid-gesture — we remember it so the trailing click doesn't open the menu.
const draggedThisGesture = ref(false)
watch(() => ctx.sortable.dragging, v => { if (v) draggedThisGesture.value = true })

function openEditor() { openFrom(cardEl.value?.$el || cardEl.value) }
function onNameDown(e) {
  draggedThisGesture.value = false
  if (ctx.charCtx.ownerMode) ctx.onDragStart(e, props.entry, props.index)
}
function openDescription(closeMenu) {
  closeMenu()
  if (ctx.item(props.entry)) ctx.openItemModal(props.entry.item_id)
}
function editWeapon(closeMenu) {
  closeMenu()
  openEditor()
}
function moveToItems(closeMenu) {
  closeMenu()
  ctx.moveWeaponToItems(props.index)
}
function deleteWeapon(closeMenu) {
  closeMenu()
  ctx.deleteWeapon(props.index)
}
</script>

<style scoped>
/* The same semantic tile is used on desktop and mobile: one weapon, one surface. */
.w-card {
  position: relative;
  padding-left: 16px;
  overflow: clip;
  cursor: pointer;
  transition: background 0.12s;
}

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

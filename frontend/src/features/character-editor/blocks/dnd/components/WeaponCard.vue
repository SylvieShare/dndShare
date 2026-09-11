<template>
  <RowActionMenu
    block
    :title="`Действия: ${ctx.itemTitle(entry)}`"
    :disabled="draggedThisGesture || (!ctx.charCtx.ownerMode && !ctx.item(entry))"
  >
    <template #trigger="{ open: menuOpen }">
      <article
        ref="cardEl"
        class="w-card action-menu-source"
        :class="{ 'sortable-placeholder': ctx.sortable.isSource(entry), 'action-menu-source--open': menuOpen }"
        :data-sortable-key="entry._key"
        @pointerdown="draggedThisGesture = false"
      >
        <WeaponCardView
          :entry="entry"
          interactive
          @name-down="onNameDown"
        />

        <RichContent v-if="entry.desc" class="w-desc-text" :html="entry.desc" />
        <WeaponItemMechanics :entry="entry" />

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
      </article>
    </template>

    <template #default="{ close: closeMenu }">
      <DamageRollOptions v-if="hasDamage || ctx.item(entry)" :can-attack="!!ctx.item(entry)" :actions="weaponDamageActions" :preview="options => ctx.damagePreview(entry, options)" :versatile="hasTwoHandedDamage" @attack="options => rollAttack(closeMenu, options)" @roll="options => rollDamage(closeMenu, options)" />

      <RowActionSeparator v-if="ctx.item(entry)" />
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
      <MagicItemMenuActions v-if="ctx.charCtx.ownerMode && entry.magic_item_id" :item="ctx.itemMap[entry.magic_item_id]" :entry="entry" :values="ctx.charCtx.values" @update:values="patch => ctx.charCtx.updateValues(patch)" @configure="ctx.openMagicInstance(entry)" @close="closeMenu" />
      <RowActionSeparator v-if="ctx.charCtx.ownerMode" />
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
import MagicItemMenuActions from './MagicItemMenuActions.vue'
import { ArrowRightLeft } from '@lucide/vue'
import { computed, inject, ref, watch } from 'vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import RichContent from '@/shared/ui/DndRichContent.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import RowActionSeparator from '@/shared/ui/RowActionSeparator.vue'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import DamageRollOptions from './DamageRollOptions.vue'
import WeaponCardView from '@/features/character-editor/blocks/dnd/components/WeaponCardView.vue'
import WeaponEditor from '@/features/character-editor/blocks/dnd/components/WeaponEditor.vue'
import WeaponItemMechanics from './WeaponItemMechanics.vue'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'

const props = defineProps({
  entry: { type: Object, required: true },
  index: { type: Number, required: true },
})

const ctx = inject('weaponsBlockCtx')
const cardEl = ref(null)
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()
const hasDamage = computed(() => ctx.hasWeaponDamage(props.entry))
const hasTwoHandedDamage = computed(() => ctx.twoHandedParts(props.entry).length > 0)
const weaponDamageActions = computed(() => ctx.weaponDamageActions(props.entry))

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
  if (ctx.item(props.entry)) ctx.openItemModal(props.entry)
}
function editWeapon(closeMenu) {
  closeMenu()
  openEditor()
}
function rollAttack(closeMenu, options) {
  closeMenu()
  ctx.rollAttack(props.entry, options)
}
function rollDamage(closeMenu, options) {
  closeMenu()
  ctx.rollDamage(props.entry, options)
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
/* The enclosing SectionList owns the surface and row separators. */
.w-card {
  position: relative;
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

/* Keep the shared row geometry when opening the editor. */
.w-morph-row { min-width: 0; }

</style>

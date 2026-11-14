<template>
  <MorphTile :outlined="false" padding="0" class="w-card"
    :class="{ 'w-card--draggable': ctx.charCtx.ownerMode && !entry.params?.creation?.expired, 'sortable-placeholder': ctx.sortable.isSource(entry), 'w-card--drop-target': ctx.sortable.dragging && ctx.sortable.targetIndex === index && !ctx.sortable.isSource(entry) }"
    :data-sortable-key="entry._key" :data-sortable-slot="index" role="group" :aria-label="ctx.itemTitle(entry)" tabindex="0" aria-haspopup="menu"
    @pointerdown.capture="draggedThisGesture = false" @pointerdown="onCardDown" @click.capture="suppressDragClick" @keydown="openActionsWithKeyboard">
    <RowActionMenu
      ref="actionMenu"
      block
      :title="`Действия: ${ctx.itemTitle(entry)}`"
      :disabled="draggedThisGesture || (!ctx.charCtx.ownerMode && !ctx.item(entry))"
    >
      <template #trigger="{ open: menuOpen }">
        <WeaponCardView ref="cardEl" class="action-menu-source" :class="{ 'action-menu-source--open': menuOpen }"
          :entry="entry" :roll-scope="directRoll?.scope" :damage-key="directRoll?.selection?.key" :collapsed="collapsed"
          :interactive="!entry.params?.creation?.expired" @roll="openDirectRoll">
          <template #actions><ActionButton icon-only variant="quiet" :aria-label="`${collapsed ? 'Развернуть' : 'Свернуть'} ${ctx.itemTitle(entry)}`" :aria-expanded="!collapsed" @click.stop="toggleCollapsed" @pointerdown.stop>
            <template #icon><ChevronDown :size="20" class="weapon-collapse-chevron" :class="{ 'weapon-collapse-chevron--expanded': !collapsed }" aria-hidden="true" /></template>
          </ActionButton></template>
          <template #default><WeaponItemMechanics v-if="!entry.params?.creation?.expired" :entry="entry" /></template>
          <template #footer><RichContent v-if="entry.desc" class="w-desc-text" :html="entry.desc" /><CreatedItemStatus :entry="entry" /></template>
        </WeaponCardView>
      </template>

      <template #default="{ close: closeMenu }">
        <CharacterMenuActions :view="ctx.item(entry) ? () => openDescription(closeMenu) : undefined"
          :edit="ctx.charCtx.ownerMode ? () => editWeapon(closeMenu) : undefined"
          :remove="ctx.charCtx.ownerMode ? () => deleteWeapon(closeMenu) : undefined" />
        <CreatedItemActions :entry="entry" @close="closeMenu" />
        <UsableItemAction source="weapon" :item="ctx.item(entry)" :entry="entry" :name="ctx.itemTitle(entry)" @close="closeMenu" />
        <ItemTransferAction source="weapon" :entry="entry" :name="ctx.itemTitle(entry)" @close="closeMenu" />
        <RowActionItem
          v-if="ctx.canMoveWeaponToItems(entry)"
          :icon="ArrowRightLeft"
          tone="info"
          @click="moveToItems(closeMenu)"
        >Переместить в вещи</RowActionItem>
        <MagicItemMenuActions v-if="ctx.charCtx.ownerMode && entry.magic_item_id" :item="ctx.itemMap[entry.magic_item_id]" :entry="entry" :values="ctx.charCtx.values" @update:values="patch => ctx.charCtx.updateValues(patch)" @configure="ctx.openMagicInstance(entry)" @close="closeMenu" />
      </template>
    </RowActionMenu>

    <WeaponRollDialog v-if="directRoll" :key="`${directRoll.scope}:${directRoll.selection?.key || ''}`" :title="`${ctx.itemTitle(entry)} · ${directRoll.scope === 'attack' ? 'Атака' : 'Урон'}`" @close="closeRoll">
      <template #preview><WeaponRollPreview :scope="directRoll.scope" :attack-bonus="previewAttackSummary.bonus" :attack-rows="previewAttackRows" :attack-color="previewAttackColor"
        :heading="selectedAlternative?.title" :damage-rows="selectedAlternative?.rows || previewDamageRows" /></template>
      <WeaponAlternativeDamageMenu v-if="directRoll.selection" dialog :entry="entry" :selection="directRoll.selection" @preview="rollPreview = $event"
        @roll-step="options => { closeRoll(); ctx.rollWeaponUseStep(entry, options.weaponUseKey, options.stepKey) }" />
      <WeaponRollSettings v-else dialog :scope="directRoll.scope" :weapon="ctx.item(entry)" :weapon-title="ctx.itemTitle(entry)"
        :summary="menuSummary" :weapon-uid="entry.uid" :actions="weaponDamageActions"
        :uses="ctx.weaponUses(entry)" @preview="rollPreview = $event"
        :bonus-action-option="options => ctx.bonusActionDamageOption(entry, options)" :versatile="hasTwoHandedDamage"
        @attack="options => rollAttack(closeRoll, options)" @roll="options => rollDamage(closeRoll, options)"
        @roll-step="options => { closeRoll(); ctx.rollWeaponUseStep(entry, options.weaponUseKey, options.stepKey) }" />
    </WeaponRollDialog>

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
  </MorphTile>
</template>
<script setup>
import CharacterMenuActions from '@/features/character-editor/components/CharacterMenuActions.vue'
import { ActionButton, MorphTile } from '@sylvieshare/share-ui'
import CreatedItemStatus from '@/features/character-editor/components/CreatedItemStatus.vue'
import CreatedItemActions from '@/features/character-editor/components/CreatedItemActions.vue'
import UsableItemAction from '@/features/character-editor/components/UsableItemAction.vue'
import ItemTransferAction from '@/features/character-editor/components/ItemTransferAction.vue'
import MagicItemMenuActions from './MagicItemMenuActions.vue'
import { ArrowRightLeft, ChevronDown } from '@lucide/vue'
import WeaponRollDialog from './WeaponRollDialog.vue'
import WeaponRollPreview from './WeaponRollPreview.vue'
import { useWeaponCardPreview } from '../composables/useWeaponCardPreview'
import { useWeaponDisclosure } from '../composables/useWeaponDisclosure'
import { computed, inject, nextTick, shallowRef, ref, watch } from 'vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import RichContent from '@/shared/ui/DndRichContent.vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import WeaponRollSettings from './WeaponRollSettings.vue'
import WeaponAlternativeDamageMenu from './WeaponAlternativeDamageMenu.vue'
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
const actionMenu = ref(null)
const directRoll = shallowRef(null)
const rollPreview = shallowRef(null)
const { collapsed, toggle: toggleCollapsed } = useWeaponDisclosure(ctx.charCtx, () => props.entry.uid)
const { attackSummary: previewAttackSummary, attackRows: previewAttackRows, attackColor: previewAttackColor,
  damageRows: previewDamageRows, alternativeDamage: previewAlternatives } = useWeaponCardPreview(ctx, () => props.entry, () => rollPreview.value)
const selectedAlternative = computed(() => previewAlternatives.value.find(row => row.key === directRoll.value?.selection?.key))
function menuSummary(options, scope) { return ctx.weaponMenuSummary(props.entry, options, scope) }
function closeRoll() { directRoll.value = null; rollPreview.value = null }
function openDirectRoll(scope, event, selection) {
  if (!ctx.charCtx.ownerMode || props.entry.params?.creation?.expired || (!ctx.item(props.entry) && (scope === 'attack' || !hasDamage.value))) return
  actionMenu.value?.close()
  rollPreview.value = { scope, options: {} }
  directRoll.value = { scope, selection }
}
watch(() => [ctx.charCtx.ownerMode, props.entry.params?.creation?.expired], ([owner, expired]) => {
  if (!owner || expired) closeRoll()
})
const { editorOpen, originRect, originEl, openFrom, close } = useMorphOrigin()
const hasDamage = computed(() => ctx.hasWeaponDamage(props.entry))
const hasTwoHandedDamage = computed(() => ctx.twoHandedParts(props.entry).length > 0)
const weaponDamageActions = computed(() => ctx.weaponDamageActions(props.entry))

// A short press opens actions; a held press reorders the tile. Roll/form controls keep their own gestures.
const draggedThisGesture = ref(false)
watch(() => ctx.sortable.dragging, v => { if (v) draggedThisGesture.value = true })
watch(() => ctx.sortable.suppressNextClick, v => { if (v) draggedThisGesture.value = true })

function openEditor() { openFrom(cardEl.value?.$el || cardEl.value) }
function onCardDown(event) {
  const control = event.target.closest('button,a,input,select,textarea,summary,[contenteditable="true"],[role="button"],[role="switch"]')
  if (control && event.currentTarget.contains(control)) return
  if (ctx.charCtx.ownerMode && !props.entry.params?.creation?.expired) ctx.onDragStart(event, props.entry, props.index)
}
async function openActionsWithKeyboard(event) {
  if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
  event.preventDefault()
  draggedThisGesture.value = false
  await nextTick()
  actionMenu.value?.toggle()
}
function suppressDragClick(event) {
  if (!draggedThisGesture.value) return
  event.preventDefault()
  event.stopImmediatePropagation()
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
.w-card {
  position: relative;
  overflow: clip;
  cursor: default;
  transition: background 0.12s;
}

.w-card.sortable-placeholder {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  outline: 2px dashed color-mix(in srgb, var(--accent) 50%, transparent);
  outline-offset: -2px;
  border-radius: 8px;
}
.w-card.sortable-placeholder > * { visibility: hidden; }
.w-card--draggable {cursor:grab;user-select:none;-webkit-touch-callout:none}
.w-card--draggable:active {cursor:grabbing}
.w-card:focus-visible {outline:2px solid var(--accent-soft);outline-offset:2px}
.w-card--drop-target {box-shadow:inset 0 0 0 2px var(--accent-soft)}

.w-desc-text {
  margin-top: var(--spacing-small);
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.45;
}

/* Keep the shared row geometry when opening the editor. */
.w-morph-row { min-width: 0; }
.weapon-collapse-chevron {transition:transform var(--motion-navigation)}
.weapon-collapse-chevron--expanded {transform:rotate(180deg)}
@media (prefers-reduced-motion:reduce) {.weapon-collapse-chevron {transition:none}}

</style>

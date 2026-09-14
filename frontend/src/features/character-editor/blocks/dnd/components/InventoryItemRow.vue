<template>
<RowActionMenu
  block
  :disabled="draggedThisGesture || (!canManage && entry.item_id == null)"
>
  <template #trigger="{ open: menuOpen }">
    <div
      class="di-row action-menu-source"
      :class="{
        'sortable-placeholder': sortable.isSource(entry),
        'di-row-draggable': canDrag,
        'di-row-tool': isToolEntry(entry),
        'action-menu-source--open': menuOpen,
      }"
      :data-sortable-key="entry.uid"
      @pointerdown="onRowDown($event, entry, sectionId, index)"
      @mouseenter="e => showTooltip(e, entry)"
      @mouseleave="hideTooltip"
    >
      <InventoryItemIcon
        :svg="entry.display.svg"
        :image-url="entry.display.iconImageUrl"
        :type-image-url="entry.display.typeImageUrl"
      />

      <span class="di-row-copy">
        <span class="di-row-name" :title="entry.display.name">
          <span class="di-row-name-text">{{ entry.display.name }}</span>
          <span v-if="entry.count > 1" class="di-count-badge">
            <span class="di-count-x">x</span>{{ entry.count }}
          </span>
        </span>
        <span v-if="!entry.params?.magic?.lost && entryTypeId(entry) === MAGIC_ITEM_TYPE_ID && entry.display.base?.data?.attunement !== 'none'" class="di-item-meta">{{ entry.params?.magic?.attuned ? 'Настроен' : 'Требует настройки' }}</span>
        <span v-if="entry.display.base?.data?.armor_base && !entry.display.base.data.armor_base.base_item_id && !entry.params?.armor_base_item_id" class="di-item-meta">Выберите основу доспеха в меню предмета</span>
        <span v-if="entry.display.base?.data?.weapon && !entry.display.base.data.weapon.base_item_id && !entry.params?.weapon_base_item_id && !entry.magic_item_id" class="di-item-meta">Выберите оружейную основу в меню предмета</span>
        <span v-if="isToolEntry(entry) || entryHasProficiency(entry) || armorMeta(entry)" class="di-item-meta">
          <span v-if="isToolEntry(entry)">{{ toolCategoryLabel(entry) }}</span>
          <span v-if="toolProficiencyRank(entry) >= 2" class="di-item-proficient">Компетентность</span>
          <span v-else-if="toolProficiencyRank(entry) >= 1" class="di-item-proficient">Владение</span>
          <template v-if="armorMeta(entry)">
            <span :class="armorMeta(entry).active ? 'di-item-armor' : 'di-item-muted'">
              {{ armorMeta(entry).active ? (armorMeta(entry).shield ? `Щит +${armorMeta(entry).value} КД` : `КД ${armorMeta(entry).value}`) : 'Не учитывается в КД' }}
            </span>
            <span v-if="!armorMeta(entry).proficient" class="di-item-danger">Нет владения</span>
            <span v-if="armorMeta(entry).stealthDisadvantage" class="di-item-danger">Помеха Скрытности</span>
          </template>
        </span>
      </span>
    </div>
    <SelectedTargetPanel :uid="entry.uid" />
    <WeaponBonusTransferPanel v-if="entry.params?.magic?.bonus_transfer" :uid="entry.uid" />
    <WeaponUsePanel v-if="entry.params?.magic?.weapon_use?.status === 'active'" :uid="entry.uid" />
    <ItemLastChargeCheck v-if="entry.params?.magic?.last_charge_check" :uid="entry.uid" />
  </template>

  <template #default="{ close }">
    <ItemTransferAction source="items" :entry="entry" :name="entry.display.name" @close="close" />
    <MagicItemMenuActions v-if="canManage && entryTypeId(entry) === MAGIC_ITEM_TYPE_ID" :item="entry.display.base" :entry="entry" :values="charCtx.values" @update:values="patch => charCtx.updateValues(patch)" @configure="openMagic(entry)" @close="close" />
    <RowActionItem
      v-if="entry.item_id != null"
      action="view"
      @click="viewEntry(entry, close)"
    >Открыть описание</RowActionItem>
    <RowActionSubmenu v-if="isToolEntry(entry)" label="Характеристика для проверки" :min-width="230">
      <template #trigger="{ open }">
        <RowActionItem :icon="Dices" tone="accent" submenu :submenu-open="open">Бросок</RowActionItem>
      </template>
      <template #default="{ close: closeAbilities }">
        <RowActionItem
          v-for="ability in toolAbilityOptions"
          :key="ability.key"
          :icon="Dices"
          @click="rollTool(entry, ability, closeAbilities, close)"
        >
          {{ ability.label }}
          <template #suffix>{{ signed(toolCheckBonus(entry, ability)) }}</template>
        </RowActionItem>
      </template>
    </RowActionSubmenu>
    <RowActionItem
      v-if="canMoveToSpecialized(entry)"
      :icon="ArrowRightLeft"
      tone="info"
      @click="moveToSpecialized(sectionId, entry, close)"
    >Переместить в «{{ specializedDestination(entry).label }}»</RowActionItem>
    <RowActionItem
      v-if="canManage"
      action="replenish"
      tone="success"
      @click="addEntry(sectionId, entry, close)"
    >Добавить +1</RowActionItem>
    <RowActionItem
      v-if="canManage && entry.count > 1"
      action="delete"
      @click="deleteOneEntry(sectionId, entry, close)"
    >Удалить одну</RowActionItem>
    <RowActionItem
      v-if="canManage && entry.item_id == null"
      action="edit"
      @click="editEntry(sectionId, entry, close)"
    >Изменить</RowActionItem>
    <RowActionItem
      v-if="canManage"
      action="delete"
      tone="danger"
      @click="deleteEntry(sectionId, entry, close)"
    >Удалить</RowActionItem>
  </template>
</RowActionMenu>
</template>

<script setup>
import ItemTransferAction from '@/features/character-editor/components/ItemTransferAction.vue'
import SelectedTargetPanel from './SelectedTargetPanel.vue'
import WeaponBonusTransferPanel from './WeaponBonusTransferPanel.vue'
import WeaponUsePanel from './WeaponUsePanel.vue'
import ItemLastChargeCheck from './ItemLastChargeCheck.vue'
import MagicItemMenuActions from './MagicItemMenuActions.vue'
import { inject, toRefs } from 'vue'
import { RowActionMenu, RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { ArrowRightLeft, Dices } from '@lucide/vue'
import InventoryItemIcon from '@/features/character-editor/components/InventoryItemIcon.vue'
import { MAGIC_ITEM_TYPE_ID } from '@/features/character-editor/lib/characterMagicItems'
defineProps({ entry: Object, sectionId: String, index: Number })
const {
  draggedThisGesture,
  canManage,
  sortable,
  canDrag,
  onRowDown,
  showTooltip,
  hideTooltip,
  isToolEntry,
  entryHasProficiency,
  armorMeta,
  toolCategoryLabel,
  toolProficiencyRank,
  entryTypeId,
  viewEntry,
  toolAbilityOptions,
  rollTool,
  signed,
  toolCheckBonus,
  canMoveToSpecialized,
  moveToSpecialized,
  specializedDestination,
  addEntry,
  deleteOneEntry,
  editEntry,
  deleteEntry,
  openMagic
} = toRefs(inject('inventoryRowCtx'))
const charCtx = inject('charCtx', {})
</script>

<style scoped>
.di-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 80px;
  padding: 14px 4px;
  transition: background 0.12s;
}
.di-row + .di-row {
  border-top: 1px solid color-mix(in srgb, var(--text-on-accent) 7%, transparent);
}
.di-row-draggable { cursor: grab; touch-action: pan-y; }
.di-row-draggable:active { cursor: grabbing; }
@media (hover: hover) {
  .di-row:hover { background: color-mix(in srgb, var(--text-on-accent) 2.5%, transparent); }
}

.di-row-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-1);
  padding: 2px 4px;
}
.di-row-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.di-item-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 4px;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.2;
}
.di-item-meta > span + span::before { margin-right: 7px; color: var(--border-strong); content: '·'; }
.di-item-proficient { color: var(--success); font-weight: 700; }
.di-item-armor { color: var(--accent); font-weight: 700; }
.di-item-muted { color: var(--text-muted); }
.di-item-danger { color: var(--danger); font-weight: 700; }
.di-row-name:hover .di-row-name-text { color: var(--accent); }

.di-row-name-text {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

.di-count-badge {
  flex-shrink: 0;
  min-width: 16px;
  height: 16px;
  box-sizing: border-box;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  color: var(--text-1);
  font-size: 10px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
}
.di-count-x { font-size: 8px; opacity: 0.75; margin-right: 1px; }
.sortable-placeholder {
  background: color-mix(in srgb, var(--accent) 8%, transparent) !important;
  outline: 2px dashed color-mix(in srgb, var(--accent) 50%, transparent);
  outline-offset: -2px;
  border-radius: 8px;
}
.sortable-placeholder > * { visibility: hidden; }
</style>

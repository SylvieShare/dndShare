<template>
<RowActionMenu
  block
  :disabled="draggedThisGesture || (!canManage && entry.item_id == null)"
>
  <template #trigger="{ open: menuOpen }">
    <InventoryBagItem :item-key="entry.uid" :item="{ iconImageUrl: entry.display.iconImageUrl || entry.display.typeImageUrl, svg: entry.display.svg }"
      :name="entry.display.name" :count="entry.count" :source="sortable.isSource(entry)" :draggable="canDrag"
      :disabled="draggedThisGesture || (!canManage && entry.item_id == null)" :status="entry.params?.magic?.attuned ? 'Настроен' : ''"
      :equipped="isEquipped(entry)" v-bind="traits" :class="{ 'action-menu-source--open': menuOpen }"
      @pointerdown="hideTooltip(); onRowDown($event, entry, spaceId, index)" @mouseenter="!sortable.dragging && showTooltip($event, entry)"
      @mouseleave="hideTooltip" @focus="showTooltip($event, entry)" @blur="hideTooltip" @click="hideTooltip" />
  </template>

  <template #default="{ close }">
    <InventoryItemMenuHeader :name="entry.display.name" />
    <div v-if="isToolEntry(entry) || entryHasProficiency(entry) || armorMeta(entry)" class="di-item-meta">
      <span v-if="isToolEntry(entry)">{{ toolCategoryLabel(entry) }}</span>
      <span v-if="toolProficiencyRank(entry) >= 2" class="di-item-proficient">Компетентность</span>
      <span v-else-if="toolProficiencyRank(entry) >= 1 || entryHasProficiency(entry)" class="di-item-proficient">Владение</span>
      <template v-if="armorMeta(entry)">
        <span>{{ armorMeta(entry).active ? (armorMeta(entry).shield ? `Щит +${armorMeta(entry).value} КД` : `КД ${armorMeta(entry).value}`) : 'Не учитывается в КД' }}</span>
        <span v-if="!armorMeta(entry).proficient" class="di-item-danger">Нет владения</span>
        <span v-if="armorMeta(entry).stealthDisadvantage" class="di-item-danger">Помеха Скрытности</span>
      </template>
    </div>
    <p v-if="!entry.params?.magic?.lost && entryTypeId(entry) === MAGIC_ITEM_TYPE_ID && entry.display.base?.data?.attunement !== 'none'" class="di-item-meta">{{ entry.params?.magic?.attuned ? 'Настроен' : 'Требует настройки' }}</p>
    <p v-if="entry.display.base?.data?.armor_base && !entry.display.base.data.armor_base.base_item_id && !entry.params?.armor_base_item_id" class="di-item-meta">Выберите основу доспеха в меню предмета</p>
    <p v-if="entry.display.base?.data?.weapon && !entry.display.base.data.weapon.base_item_id && !entry.params?.weapon_base_item_id && !entry.magic_item_id" class="di-item-meta">Выберите оружейную основу в меню предмета</p>
    <CreatedItemStatus :entry="entry" />
    <WeaponNotePanels :notes="notes" :item="entry.display.base" />
    <SelectedTargetPanel :uid="entry.uid" />
    <WeaponBonusTransferPanel v-if="entry.params?.magic?.bonus_transfer" :uid="entry.uid" />
    <WeaponUsePanel v-if="entry.params?.magic?.weapon_use?.status === 'active'" :uid="entry.uid" />
    <ItemLastChargeCheck v-if="entry.params?.magic?.last_charge_check" :uid="entry.uid" />
    <RowActionItem v-if="canEquip(entry)" :icon="isEquipped(entry) ? Shirt : ShieldCheck" tone="accent" @click="toggleEquipment(entry, close)">
      {{ isEquipped(entry) ? 'Снять' : 'Экипировать' }}
    </RowActionItem>
    <UsableItemAction source="items" :item="entry.display.base" :entry="entry" :name="entry.display.name" @close="close" />
    <CreatedItemActions :entry="entry" @close="close" />
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
import InventoryItemMenuHeader from '@/features/inventory/components/InventoryItemMenuHeader.vue'
import InventoryBagItem from '@/features/inventory/components/InventoryBagItem.vue'
import CreatedItemStatus from '@/features/character-editor/components/CreatedItemStatus.vue'
import CreatedItemActions from '@/features/character-editor/components/CreatedItemActions.vue'
import UsableItemAction from '@/features/character-editor/components/UsableItemAction.vue'
import ItemTransferAction from '@/features/character-editor/components/ItemTransferAction.vue'
import SelectedTargetPanel from './SelectedTargetPanel.vue'
import WeaponBonusTransferPanel from './WeaponBonusTransferPanel.vue'
import WeaponUsePanel from './WeaponUsePanel.vue'
import ItemLastChargeCheck from './ItemLastChargeCheck.vue'
import MagicItemMenuActions from './MagicItemMenuActions.vue'
import { computed, inject, toRefs, unref } from 'vue'
import { inventoryCellTraits } from '@/features/inventory/lib/cellTraits'
import WeaponNotePanels from '@/features/items/components/WeaponNotePanels.vue'
import { visibleWeaponNotes } from '@/features/character-editor/lib/weaponNotes'
import { RowActionMenu, RowActionSubmenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { ArrowRightLeft, Dices, ShieldCheck, Shirt } from '@lucide/vue'
import { MAGIC_ITEM_TYPE_ID } from '@/features/character-editor/lib/characterMagicItems'
const props = defineProps({ entry: Object, sectionId: String, index: Number, spaceId: String })
const {
  draggedThisGesture,
  canManage,
  isEquipped,
  canEquip,
  toggleEquipment,
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
const traits = computed(() => inventoryCellTraits(props.entry.display.base, props.entry, isEquipped.value(props.entry)))
const notes = computed(() => visibleWeaponNotes(props.entry.display.base, props.entry, isEquipped.value(props.entry), unref(charCtx.values)))
</script>

<style scoped>
.di-item-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; margin: 4px 8px; color: var(--text-muted); font-size: 11px; line-height: 1.3; }
.di-item-proficient { color: var(--success); font-weight: 700; }
.di-item-danger { color: var(--danger); font-weight: 700; }
</style>

import { computed, ref } from 'vue'
import { fetchGet } from '@/shared/api/http'
import { armorRuleByName } from '@/features/character-editor/settings/dnd/creation/armorRules'
import {
  mergeEquipment,
  resolveStartingEquipmentProfile,
  selectedStartingEquipment,
  startingEquipmentComplete,
  startingEquipmentProfile,
} from '@/features/character-editor/settings/dnd/creation/startingEquipment'
import {
  cartCostCopper,
  copperToWallet,
  formatCopper,
  itemCostCopper,
  rollStartingWealth,
  startingWealthFormula,
} from '@/features/character-editor/settings/dnd/creation/startingShop'

const CATALOGUE_TYPE_IDS = [1, 2, 10, 12, 13]

function inventoryEntry(item, count = 1) {
  return {
    id: item.id,
    name: item.name,
    count: Math.max(1, Math.floor(Number(count) || 1)),
    typeId: item.typeId,
    armor: item.data?.armor || armorRuleByName(item.name),
    data: item.data || {},
    iconImageUrl: item.iconImageUrl || null,
    svg: item.svg || null,
    coverImageUrl: item.coverImageUrl || null,
  }
}

export function useDndCreateEquipment({ state, sourceSuffix }) {
  const equipmentCatalogue = ref([])
  const shopLoading = ref(false)

  async function loadEquipmentCatalogue() {
    shopLoading.value = true
    try {
      const responses = await Promise.all(CATALOGUE_TYPE_IDS.map((typeId) => (
        fetchGet(`/items?typeId=${typeId}&limit=500${sourceSuffix()}`)
      )))
      equipmentCatalogue.value = responses.flatMap((response) => response?.items || [])
    } finally {
      shopLoading.value = false
    }
  }

  async function ensureEquipmentCatalogueItems(ids) {
    const known = new Set(equipmentCatalogue.value.map((item) => String(item.id)))
    const missing = [...new Set((ids || []).map(Number).filter((id) => id > 0 && !known.has(String(id))))]
    if (!missing.length) return
    const response = await fetchGet(`/items/by-ids?ids=${missing.join(',')}`)
    const next = [...equipmentCatalogue.value]
    for (const item of (response?.items || [])) {
      if (!next.some((saved) => String(saved.id) === String(item.id))) next.push(item)
    }
    equipmentCatalogue.value = next
  }

  const baseClassEquipmentProfile = computed(() => startingEquipmentProfile(state.charClass))
  const classEquipmentProfile = computed(() => resolveStartingEquipmentProfile(
    baseClassEquipmentProfile.value,
    equipmentCatalogue.value.filter((item) => [1, 2, 12].includes(Number(item.typeId)) && item.userId == null),
  ))
  const classEquipmentComplete = computed(() => state.buyStartingEquipment
    || startingEquipmentComplete(classEquipmentProfile.value, state.classEquipmentChoices))
  const classEquipment = computed(() => state.buyStartingEquipment
    ? []
    : selectedStartingEquipment(classEquipmentProfile.value, state.classEquipmentChoices))
  const allEquipment = computed(() => state.buyStartingEquipment
    ? mergeEquipment(state.startingShopCart)
    : mergeEquipment(classEquipment.value, state.equipment))

  const startingShopItems = computed(() => equipmentCatalogue.value
    .filter((item) => item.userId == null && item.data?.available_in_starting_shop === true)
    .filter((item) => itemCostCopper(item) != null)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru')))
  const startingWealthFormulaLabel = computed(() => startingWealthFormula(baseClassEquipmentProfile.value?.key))
  const startingWealthCopper = computed(() => Math.max(0, Number(state.startingWealthRoll?.gold) || 0) * 100)
  const shopSpentCopper = computed(() => cartCostCopper(state.startingShopCart))
  const shopRemainingCopper = computed(() => Math.max(0, startingWealthCopper.value - shopSpentCopper.value))
  const shopSpentLabel = computed(() => formatCopper(shopSpentCopper.value))
  const shopRemainingLabel = computed(() => formatCopper(shopRemainingCopper.value))
  const shopWallet = computed(() => copperToWallet(shopRemainingCopper.value))

  function selectEquipmentOption(groupId, optionId) {
    state.classEquipmentChoices = { ...state.classEquipmentChoices, [groupId]: { optionId, picks: {} } }
  }

  function setEquipmentPick(groupId, optionId, pickId, index, value) {
    const current = state.classEquipmentChoices[groupId]
    const picks = current?.optionId === optionId ? { ...(current.picks || {}) } : {}
    const values = [...(picks[pickId] || [])]
    if (value) values[index] = value
    else values[index] = ''
    picks[pickId] = values
    state.classEquipmentChoices = { ...state.classEquipmentChoices, [groupId]: { optionId, picks } }
  }

  function addEquipment(item, quantity = 1) {
    if (!item?.id) return
    const next = inventoryEntry(item, quantity)
    const existing = state.equipment.find((entry) => String(entry.id) === String(item.id))
    if (existing) existing.count += next.count
    else state.equipment.push(next)
  }
  function removeEquipment(id) {
    const index = state.equipment.findIndex((entry) => String(entry.id) === String(id))
    if (index >= 0) state.equipment.splice(index, 1)
  }
  function bumpEquipment(id, delta) {
    const entry = state.equipment.find((item) => String(item.id) === String(id))
    if (entry) entry.count = Math.max(1, entry.count + delta)
  }

  function rerollStartingWealth() {
    state.startingWealthRoll = rollStartingWealth(baseClassEquipmentProfile.value?.key)
    state.startingShopCart = []
  }
  function setBuyStartingEquipment(enabled) {
    state.buyStartingEquipment = !!enabled
    state.equipment = []
    state.startingShopCart = []
    state.startingWealthRoll = enabled ? rollStartingWealth(baseClassEquipmentProfile.value?.key) : null
  }
  function resetEquipmentForClass() {
    state.classEquipmentChoices = {}
    state.equipment = []
    state.startingShopCart = []
    state.startingWealthRoll = state.buyStartingEquipment
      ? rollStartingWealth(baseClassEquipmentProfile.value?.key)
      : null
  }

  function addShopItem(item) {
    const price = itemCostCopper(item)
    if (price == null || price > shopRemainingCopper.value) return
    const existing = state.startingShopCart.find((entry) => String(entry.id) === String(item.id))
    if (existing) existing.count += 1
    else state.startingShopCart.push(inventoryEntry(item))
  }
  function removeShopItem(id) {
    const index = state.startingShopCart.findIndex((entry) => String(entry.id) === String(id))
    if (index >= 0) state.startingShopCart.splice(index, 1)
  }
  function bumpShopItem(id, delta) {
    const entry = state.startingShopCart.find((item) => String(item.id) === String(id))
    if (!entry) return
    if (delta > 0 && itemCostCopper(entry) > shopRemainingCopper.value) return
    if (delta < 0 && entry.count <= 1) { removeShopItem(id); return }
    entry.count = Math.max(1, entry.count + delta)
  }
  function canBuyShopItem(item) {
    const price = itemCostCopper(item)
    return price != null && price <= shopRemainingCopper.value
  }

  return {
    loadEquipmentCatalogue, ensureEquipmentCatalogueItems, equipmentCatalogue, shopLoading,
    classEquipmentProfile, classEquipmentComplete, classEquipment, allEquipment,
    selectEquipmentOption, setEquipmentPick,
    addEquipment, removeEquipment, bumpEquipment,
    setBuyStartingEquipment, resetEquipmentForClass, rerollStartingWealth,
    startingShopItems, startingWealthFormulaLabel, startingWealthCopper,
    shopSpentCopper, shopRemainingCopper, shopSpentLabel, shopRemainingLabel, shopWallet,
    addShopItem, removeShopItem, bumpShopItem, canBuyShopItem,
  }
}

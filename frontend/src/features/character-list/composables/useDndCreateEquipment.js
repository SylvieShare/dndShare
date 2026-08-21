import { computed, ref } from 'vue'
import { defaultInstanceParams, instanceParamsKey } from '@/features/items/lib/itemInstance'
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

const CATALOGUE_TYPE_IDS = [1, 2, 10, 12, 13, 14]

function inventoryEntry(item, count = 1, type = null) {
  return {
    item_id: item.id,
    name: item.name,
    count: Math.max(1, Math.floor(Number(count) || 1)),
    params: { ...defaultInstanceParams(type, item), ...(item.params || {}) },
    typeId: item.typeId,
    armor: item.data?.armor || armorRuleByName(item.name),
    data: item.data || {},
    iconImageUrl: item.iconImageUrl || null,
    svg: item.svg || null,
    coverImageUrl: item.coverImageUrl || null,
  }
}

function sameInstance(entry, reference) {
  const itemId = reference?.item_id ?? reference?.id ?? reference
  const params = reference && typeof reference === 'object' ? reference.params : null
  return String(entry.item_id) === String(itemId)
    && (params == null || instanceParamsKey(entry.params) === instanceParamsKey(params))
}

export function useDndCreateEquipment({ state, sourceSuffix }) {
  const equipmentCatalogue = ref([])
  const equipmentTypes = ref([])
  const shopLoading = ref(false)
  const typeById = (id) => equipmentTypes.value.find((type) => Number(type.id) === Number(id)) || null

  async function loadEquipmentCatalogue() {
    shopLoading.value = true
    try {
      const [responses, typesResponse] = await Promise.all([
        Promise.all(CATALOGUE_TYPE_IDS.map((typeId) => fetchGet(`/items?typeId=${typeId}&limit=500${sourceSuffix()}`))),
        fetchGet('/item-types'),
      ])
      equipmentCatalogue.value = responses.flatMap((response) => response?.items || [])
      equipmentTypes.value = typesResponse?.types || []
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
    equipmentCatalogue.value.filter((item) => [1, 2, 12, 14].includes(Number(item.typeId)) && item.userId == null),
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
    .map((item) => ({ ...item, params: defaultInstanceParams(typeById(item.typeId), item) }))
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
    const next = inventoryEntry(item, quantity, typeById(item.typeId))
    const existing = state.equipment.find((entry) => String(entry.item_id) === String(item.id)
      && instanceParamsKey(entry.params) === instanceParamsKey(next.params))
    if (existing) existing.count += next.count
    else state.equipment.push(next)
  }
  function removeEquipment(reference) {
    const index = state.equipment.findIndex((entry) => sameInstance(entry, reference))
    if (index >= 0) state.equipment.splice(index, 1)
  }
  function bumpEquipment(reference, delta) {
    const entry = state.equipment.find((item) => sameInstance(item, reference))
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
    const next = inventoryEntry(item, 1, typeById(item.typeId))
    const existing = state.startingShopCart.find((entry) => String(entry.item_id) === String(item.id)
      && instanceParamsKey(entry.params) === instanceParamsKey(next.params))
    if (existing) existing.count += 1
    else state.startingShopCart.push(next)
  }
  function removeShopItem(reference) {
    const index = state.startingShopCart.findIndex((entry) => sameInstance(entry, reference))
    if (index >= 0) state.startingShopCart.splice(index, 1)
  }
  function bumpShopItem(reference, delta) {
    const entry = state.startingShopCart.find((item) => sameInstance(item, reference))
    if (!entry) return
    if (delta > 0 && itemCostCopper(entry) > shopRemainingCopper.value) return
    if (delta < 0 && entry.count <= 1) { removeShopItem(reference); return }
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

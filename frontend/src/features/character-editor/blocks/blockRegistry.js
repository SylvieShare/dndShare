import AvatarBlock from '@/features/character-editor/blocks/generic/AvatarBlock'
import BlockMoney from '@/features/character-editor/blocks/generic/BlockMoney'
import BlockResources from '@/features/character-editor/blocks/generic/BlockResources'
import BlockStates from '@/features/character-editor/blocks/generic/BlockStates'
import BlockTags from '@/features/character-editor/blocks/generic/BlockTags'
import CampaignBadge from '@/features/character-editor/blocks/generic/CampaignBadge'
import InputDescription from '@/shared/ui/InputDescription'
import InputIntBlock from '@/features/character-editor/blocks/generic/InputIntBlock'
import InputItem from '@/features/character-editor/blocks/generic/InputItem'
import InputSuggest from '@/features/character-editor/blocks/generic/InputSuggest'
import InputText from '@/features/character-editor/blocks/generic/InputText'
import LinePoints from '@/features/character-editor/blocks/generic/LinePoints'
import LinePointsList from '@/features/character-editor/blocks/generic/LinePointsList'
import SettingsMenuTile from '@/features/character-editor/blocks/generic/SettingsMenuTile'
import StubTile from '@/features/character-editor/blocks/generic/StubTile'
import DndAbilities from '@/features/character-editor/blocks/dnd/DndAbilities'
import DndAlignment from '@/features/character-editor/blocks/dnd/DndAlignment'
import DndArmor from '@/features/character-editor/blocks/dnd/DndArmor'
import DndCharIdentity from '@/features/character-editor/blocks/dnd/DndCharIdentity'
import DndCharStat10 from '@/features/character-editor/blocks/dnd/DndCharStat10'
import DndCounters from '@/features/character-editor/blocks/dnd/DndCounters'
import DndDiary from '@/features/character-editor/blocks/dnd/DndDiary'
import DndExhaustion from '@/features/character-editor/blocks/dnd/DndExhaustion'
import DndHitDice from '@/features/character-editor/blocks/dnd/DndHitDice'
import DndHp from '@/features/character-editor/blocks/dnd/DndHp'
import DndInitiative from '@/features/character-editor/blocks/dnd/DndInitiative'
import DndItems from '@/features/character-editor/blocks/dnd/DndItems'
import DndSpeed from '@/features/character-editor/blocks/dnd/DndSpeed'
import DndLvl from '@/features/character-editor/blocks/dnd/DndLvl'
import DndMobileStatusMenu from '@/features/character-editor/blocks/dnd/DndMobileStatusMenu'
import DndPotions from '@/features/character-editor/blocks/dnd/DndPotions'
import DndProfBonus from '@/features/character-editor/blocks/dnd/DndProfBonus'
import DndQuests from '@/features/character-editor/blocks/dnd/DndQuests'
import DndRest from '@/features/character-editor/blocks/dnd/DndRest'
import DndSpells from '@/features/character-editor/blocks/dnd/DndSpells'
import DndStatusOverview from '@/features/character-editor/blocks/dnd/DndStatusOverview'
import DndTools from '@/features/character-editor/blocks/dnd/DndTools'
import DndWeapons from '@/features/character-editor/blocks/dnd/DndWeapons'
import LayoutInnerTabs from '@/features/character-editor/blocks/layout/LayoutInnerTabs'
import SectionHeader from '@/features/character-editor/blocks/layout/SectionHeader'
import VtmBloodPool from '@/features/character-editor/blocks/vtm/VtmBloodPool'
import VtmHealth from '@/features/character-editor/blocks/vtm/VtmHealth'

/**
 * Maps block type strings to component definitions.
 *
 * Flags:
 *   passValues  – pass `values` and `vars` props to the component
 *   passValuesOnly – pass only `values` (no vars)
 *   noValuePreset  – use values[id] without falling back to block.preset
 */
export const BLOCK_REGISTRY = {
  AVATARS:          { component: AvatarBlock },
  BLOCK_ITEMS:      { component: DndItems },
  BLOCK_MONEY:      { component: BlockMoney },
  BLOCK_RESOURCES:  { component: BlockResources },
  BLOCK_COUNTERS:   { component: DndCounters },
  BLOCK_STATES:     { component: BlockStates, noValuePreset: true },
  BLOCK_TAGS:       { component: BlockTags },
  CAMPAIGN_BADGE:   { component: CampaignBadge, noValue: true },
  BLOCK_LVL:        { component: DndLvl, passValues: true },
  DND_ABILITIES:    { component: DndAbilities, passValuesOnly: true },
  DND_ALIGNMENT:    { component: DndAlignment },
  DND_ARMOR:        { component: DndArmor, passValues: true },
  DND_CHAR_IDENTITY:{ component: DndCharIdentity, passValues: true },
  DND_CHAR_STAT_10: { component: DndCharStat10, passValues: true },
  DND_DIARY:        { component: DndDiary },
  DND_EXHAUSTION:   { component: DndExhaustion },
  DND_HIT_DICE:     { component: DndHitDice },
  DND_HP:           { component: DndHp, passValues: true },
  DND_INITIATIVE:   { component: DndInitiative, passValuesOnly: true },
  DND_MOBILE_STATUS_MENU: { component: DndMobileStatusMenu, noValue: true, passValuesOnly: true },
  DND_POTIONS:      { component: DndPotions },
  DND_PROF_BONUS:   { component: DndProfBonus, passValues: true },
  DND_QUESTS:       { component: DndQuests },
  DND_REST:         { component: DndRest, noValue: true, passValuesOnly: true },
  DND_SPEED:        { component: DndSpeed },
  DND_SPELLS:       { component: DndSpells, passValuesOnly: true },
  DND_STATUS_OVERVIEW: { component: DndStatusOverview, noValue: true, passValuesOnly: true },
  DND_TOOLS:        { component: DndTools },
  DND_WEAPONS:      { component: DndWeapons, passValues: true },
  INPUT_DESCRIPTION:{ component: InputDescription },
  INPUT_INT_BLOCK:  { component: InputIntBlock },
  INPUT_SUGGEST:    { component: InputSuggest },
  INPUT_ITEM:       { component: InputItem, passValuesOnly: true },
  INPUT_TEXT:       { component: InputText },
  LINE_POINTS:      { component: LinePoints },
  LINE_POINTS_LIST: { component: LinePointsList },
  INNER_TABS:       { component: LayoutInnerTabs, noValue: true, passValues: true },
  SECTION_HEADER:   { component: SectionHeader, noValue: true },
  SETTINGS_MENU:    { component: SettingsMenuTile, noValue: true },
  STUB_TILE:        { component: StubTile, noValue: true },
  VTM_BLOOD_POOL:   { component: VtmBloodPool },
  VTM_HEALTH:       { component: VtmHealth },
}

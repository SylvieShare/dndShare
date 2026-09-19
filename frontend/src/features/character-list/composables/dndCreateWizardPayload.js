import { applyAbilitySelection } from '@/features/character-editor/lib/selectedAbilities'
import { buildCharacterData } from '@/features/character-editor/settings/dnd/creation/buildCharacter'
import { normalizeContentSourceSettings } from '@/shared/api/contentSourcesApi'

function selectedItem(item) {
  return item ? { id: item.id, name: item.name, item } : null
}

export function buildDndCharacterPayload({
  state,
  stats,
  spellPool,
  grantedSpellList,
  featPool,
  equipment,
  backgroundEquipment,
  backgroundToolProficiencies,
  buyStartingEquipment,
  startingWallet,
  grantedSpellIds,
  featureChoices,
  raceAbilities,
  classAbilities,
  suggestValue,
  isExpertiseChoice,
}) {
  const payload = buildCharacterData({
    rulesVersion: state.version,
    backgroundAsi: state.backgroundAsi,
    originFeatChoices: state.originFeatChoices,
    originFeat: featPool.find(feat => Number(feat.id) === Number(state.background?.data?.origin_feat_id || state.originFeatId)),
    name: state.name.trim(),
    race: selectedItem(state.race),
    subrace: selectedItem(state.subrace),
    charClass: selectedItem(state.charClass),
    subclass: selectedItem(state.subclass),
    raceVariant: state.raceVariant,
    background: selectedItem(state.background),
    scores: Object.fromEntries(stats.map((stat) => [stat, Number(state.scores[stat] ?? 10)])),
    asiChoice: state.asiChoice.slice(),
    raceSkillIds: state.raceSkillIds.slice(),
    raceLangIds: state.raceLangIds.slice(),
    featIds: state.featIds.slice(),
    feats: state.featIds.map((id) => ({
      item: featPool.find((feat) => String(feat.id) === String(id)) || { id, data: {} },
      choices: state.featSelections?.[id] || {},
    })),
    bgLangIds: state.bgLangIds.slice(),
    equipment: equipment.map((entry) => ({ ...entry })),
    backgroundEquipment: {
      items: (backgroundEquipment?.items || []).map((entry) => ({ ...entry })),
      coins: { ...(backgroundEquipment?.coins || {}) },
    },
    backgroundToolProficiencies: (backgroundToolProficiencies || []).map((selection) => ({ ...selection })),
    buyStartingEquipment,
    startingWallet: { ...(startingWallet || {}) },
    persona: { ...state.persona },
    skillIds: state.skillIds.slice(),
    classToolProficiencyIds: state.classToolProficiencyIds.slice(),
    spellIds: state.spellIds.slice(),
    spellLevels: Object.fromEntries(
      [...(spellPool || []), ...(grantedSpellList || [])]
        .filter((spell) => spell.data?.lvl != null)
        .map((spell) => [String(spell.id), Number(spell.data?.lvl) || 0]),
    ),
    grantedSpellIds: grantedSpellIds.slice(),
    choices: featureChoices.map((feature) => ({
      abilityId: feature.abilityId,
      choiceKey: feature.choiceKey,
      selectionKey: feature.id,
      from_suggest_id: feature.choice.from_suggest_id,
      expertise: isExpertiseChoice(feature),
      selected: (state.choices[feature.id] || []).slice(),
    })),
    raceAbilityItems: raceAbilities,
    classAbilityItems: classAbilities,
    suggestValue,
    contentSources: normalizeContentSourceSettings(state.contentSources),
  })
  for (const [parentId, plan] of Object.entries(state.abilitySelections || {})) {
    const parent = classAbilities.find(item => String(item.id) === parentId)
    if (parent) payload.data.values = applyAbilitySelection(payload.data.values, parent, plan.entries || [], classAbilities)
  }
  const iconUploadId = Number(state.persona?.icon?.upload_id)
  return {
    ...payload,
    ...(iconUploadId > 0 ? { iconImageUploadId: iconUploadId } : {}),
  }
}

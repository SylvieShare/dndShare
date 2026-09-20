export const STORY_ABILITY_TYPE_ID = 18
export const ABILITY_TYPE_IDS = [3, 4, STORY_ABILITY_TYPE_ID]
export const ABILITY_VALUE_IDS = ['abilities_race', 'abilities_class', 'abilities_story', 'abilities_feats']

export function visibleHandbookType(type) {
  if ([16, 17].includes(Number(type.id))) return false
  return Number(type.id) !== STORY_ABILITY_TYPE_ID || Number(type.countItems) > 0
}

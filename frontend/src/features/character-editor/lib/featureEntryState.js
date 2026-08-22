export function featureEntryActive(valueId, entry) {
  return valueId !== 'abilities_feats' || entry?.requirements_met !== false
}

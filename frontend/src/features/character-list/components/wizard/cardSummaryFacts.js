export function suggestNames(ids, typeId, suggestValue) {
  return [...new Set((ids || []).map((id) => suggestValue(typeId, id)).filter(Boolean))]
}

export function pushFact(facts, label, value, wide = false, entries = []) {
  if (value) facts.push({ label, value, wide, entries })
}

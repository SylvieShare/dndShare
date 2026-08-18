export function choicePresentation(choice) {
  const suggestTypeId = Number(choice?.from_suggest_id)
  if (suggestTypeId === 6) return 'language'
  if (suggestTypeId === 15) return 'skill'
  if (!suggestTypeId) return 'list'
  return 'chips'
}

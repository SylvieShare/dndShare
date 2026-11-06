export function addCustomSkill(skills, name) {
  const title = (name || '').trim()
  if (!title) return skills
  // Custom skill: no suggest entry, so we mint a unique non-suggest id and store the typed name as
  // the override title (skillsList resolves a custom skill's title from override_title).
  const id = 'c' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36)
  return { ...skills, [id]: { up: 0, override_title: title, bonuses: [] } }
}

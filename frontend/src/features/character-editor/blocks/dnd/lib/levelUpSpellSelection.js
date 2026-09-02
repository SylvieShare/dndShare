import { emptySpellbook, findClassSpellTab, spellEntry, spellTab } from './spellbook'

/** Replace only one class tab's editable spell list; grants and other tabs stay intact. */
export function applyLevelUpSpellSelection(book, selection) {
  const next = emptySpellbook(book)
  if (!selection?.tab || !Array.isArray(selection.entries)) return next

  const selectedTab = spellTab(selection.tab)
  let target = findClassSpellTab(next.tabs, selectedTab.class_item_id)
    || next.tabs.find((tab) => tab.key === selectedTab.key)
  if (!target) {
    target = selectedTab
    next.tabs.push(target)
  } else {
    target.name = selectedTab.name
    target.class_item_id = selectedTab.class_item_id
    target.casting_ability = selectedTab.casting_ability
    target.mode = selectedTab.mode
    target.save_bonus = selectedTab.save_bonus
    target.attack_bonus = selectedTab.attack_bonus
  }

  const currentById = new Map((target.spells || []).map((entry) => [String(entry.id), entry]))
  target.spells = selection.entries.map((chosen) => {
    const current = currentById.get(String(chosen.id))
    return spellEntry(chosen.id, {
      key: chosen.key || current?.key,
      prepared: target.mode !== 'known' && Number(chosen.level) > 0,
    })
  })
  return next
}

import { BookOpenText, Globe, History, Images, Map, NotebookPen, ScrollText, Settings, Swords, UsersRound } from '@lucide/vue'

export function sessionNavigationItems({ isDm, combatActive, encounterActive }) {
  const combatLabel = `${combatActive ? 'Бой открыт' : 'Открыть бой'} · бой ${encounterActive ? 'идёт' : 'не запущен'}`
  const story = { key: 'story', label: 'Сюжет', icon: BookOpenText, shortcut: '1' }
  const combat = { key: 'combat', label: 'Бой', icon: Swords, shortcut: 'B', ariaLabel: combatLabel, title: combatLabel,
    attrs: { 'data-tutorial': 'session-combat', 'data-combat-state': `${combatActive ? 'open' : 'closed'}-${encounterActive ? 'running' : 'stopped'}`, 'aria-keyshortcuts': 'Shift+B' } }
  const items = [story, combat]
  if (isDm) items.push(
    { key: 'maps', label: 'Карта', icon: Map },
    { key: 'globalMaps', label: 'Мир', icon: Globe, attrs: { 'data-tutorial': 'session-global-navigation' } },
    { key: 'locations', label: 'Локации', icon: Map, shortcut: '2', divider: true, dividerLabel: 'Мир и материалы' },
    { key: 'npcs', label: 'NPC', icon: UsersRound, shortcut: '3' },
    { key: 'quests', label: 'Задания', icon: ScrollText, shortcut: '4' },
    { key: 'materials', label: 'Материалы', icon: Images, shortcut: '5' },
    { key: 'journal', label: 'Дневник', icon: NotebookPen, shortcut: '7', divider: true, dividerLabel: 'Журналы' },
    { key: 'events', label: 'Хроника', icon: History, shortcut: '8' },
    { key: 'settings', label: 'Настройки', icon: Settings },
  )
  return items.map(item => ({ ...item, attrs: { ...(item.shortcut && item.key !== 'combat' ? { 'aria-keyshortcuts': `Alt+${item.shortcut}` } : {}), ...item.attrs } }))
}
export function selectedSessionNavigation(primaryView, combatActive) {
  return primaryView === 'story' && combatActive ? 'combat' : primaryView
}

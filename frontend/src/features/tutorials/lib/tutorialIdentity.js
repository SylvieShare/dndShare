export const TUTORIAL_REVISION = 1
export const TUTORIAL_NAMES = { character: 'Лист персонажа', 'session-player': 'Сессия игрока', 'session-dm': 'Сессия мастера' }
export function tutorialKey(entry) {
  return JSON.stringify([entry.flowId, entry.sourceKey, entry.device])
}
export function hasSeenTutorial(entries, context) {
  return entries.some(entry => tutorialKey(entry) === tutorialKey(context) && entry.revision >= context.revision)
}

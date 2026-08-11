// Pure helpers for the DND_QUESTS block value: a flat array of quests
//   { id, title, desc, reward, status }
// `status` is one of QUEST_STATUSES values; unknown statuses normalize to 'active'.

export const QUEST_STATUSES = [
  { value: 'active', label: 'В работе', color: 'var(--accent)' },
  { value: 'done', label: 'Выполнено', color: 'var(--success)' },
  { value: 'failed', label: 'Провалено', color: 'var(--danger)' },
]

const STATUS_VALUES = QUEST_STATUSES.map(s => s.value)

export function questStatusMeta(status) {
  return QUEST_STATUSES.find(s => s.value === status) || QUEST_STATUSES[0]
}

let seq = 0
export function makeQuestId() {
  seq += 1
  return 'qst' + seq.toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

export function defaultQuest() {
  return { id: makeQuestId(), title: '', desc: '', reward: '', status: 'active' }
}

export function normalizeQuest(q) {
  const src = q && typeof q === 'object' ? q : {}
  return {
    id: typeof src.id === 'string' && src.id ? src.id : makeQuestId(),
    title: typeof src.title === 'string' ? src.title : '',
    desc: typeof src.desc === 'string' ? src.desc : '',
    reward: typeof src.reward === 'string' ? src.reward : '',
    status: STATUS_VALUES.includes(src.status) ? src.status : 'active',
  }
}

export function normalizeQuests(value) {
  if (!Array.isArray(value)) return []
  return value.map(normalizeQuest)
}

export function patchQuest(quest, patch) {
  return normalizeQuest({ ...quest, ...patch })
}

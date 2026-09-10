export function defaultObjective() {
  return { id: crypto.randomUUID(), text: '', done: false }
}

export function normalizeJournalQuest(value) {
  const source = value && typeof value === 'object' ? value : {}
  return {
    reward: typeof source.reward === 'string' ? source.reward : '',
    objectives: (Array.isArray(source.objectives) ? source.objectives : []).map(row => ({
      id: typeof row?.id === 'string' ? row.id : crypto.randomUUID(),
      text: typeof row?.text === 'string' ? row.text : '',
      done: row?.done === true,
    })),
  }
}

export function questProgress(quest) {
  const total = quest.objectives.length
  const done = quest.objectives.filter(row => row.done).length
  return { total, done, complete: total > 0 && done === total, percent: total ? done / total * 100 : 0 }
}

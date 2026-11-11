export function createJournalBuffer(database, initial = []) {
  const values = new Map(initial)
  const dirty = new Map()
  let writing, failure
  function schedule() {
    if (writing || !dirty.size) return
    const batch = new Map(dirty)
    dirty.clear()
    writing = database.batch([...batch].map(([key, value]) => ({ key: `journal:${key}`, value })))
      .then(() => { failure = null })
      .catch(error => {
        failure = error
        for (const [key, value] of batch) if (!dirty.has(key)) dirty.set(key, value)
      }).finally(() => { writing = null })
  }
  const change = (key, value) => { dirty.set(key, value); schedule() }
  return {
    get length() { return values.size },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { values.set(key, value); change(key, value) },
    removeItem(key) { values.delete(key); change(key, null) },
    async flush() {
      await writing
      if (dirty.size) { schedule(); await writing }
      if (failure) throw failure
      if (dirty.size) return this.flush()
    },
    replace(entries) { values.clear(); for (const [key, value] of entries) values.set(key, value) },
  }
}

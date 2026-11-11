import { allLocalRecords, openLocalDatabase } from './storage'
import { createJournalBuffer } from './journalBuffer'

let journal
export function outboxStorage() { return journal || globalThis.localStorage }

// Keep the editor's synchronous contract; the sender waits for the durable transaction.
export async function prepareLocalJournal() {
  const db = await openLocalDatabase()
  journal = createJournalBuffer(db, (await allLocalRecords('journal:')).map(({ key, value }) => [key.slice(8), value]))
  journal.refresh = async () => {
    await journal.flush()
    journal.replace((await allLocalRecords('journal:')).map(({ key, value }) => [key.slice(8), value]))
  }
  return journal
}

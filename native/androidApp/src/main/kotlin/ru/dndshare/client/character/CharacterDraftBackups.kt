package ru.dndshare.client.character

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import ru.dndshare.client.data.*
import ru.dndshare.client.device.DeviceServices
import ru.dndshare.client.model.WireJson

@Serializable
private data class DraftBackup(val uuid: String, val payload: String, val draft: String)
private fun backupKey(userId: Long) = "character-sheet-drafts:$userId"

/** Authentication expiry clears readable caches, but retains unacknowledged work encrypted. */
suspend fun retainCharacterDrafts(platform: DeviceServices, userId: Long, database: ClientDatabase) = withContext(Dispatchers.IO) {
    val dao = database.characterSheets()
    val rows = dao.pending().mapNotNull { dao.get(it) }.map { DraftBackup(it.uuid, it.payload, it.draft) }
    if (rows.isNotEmpty()) platform.secureStore.write(backupKey(userId), WireJson.encodeToString(rows))
}

suspend fun restoreCharacterDrafts(platform: DeviceServices, userId: Long, database: ClientDatabase) = withContext(Dispatchers.IO) {
    val stored = platform.secureStore.read(backupKey(userId)) ?: return@withContext
    val rows = WireJson.decodeFromString<List<DraftBackup>>(stored)
    for (row in rows) {
        require(WireJson.decodeFromString<CharacterSheet>(row.payload).userId == userId)
        if (database.characterSheets().get(row.uuid) == null) database.characterSheets().put(CachedCharacterSheet(row.uuid, row.payload, row.draft))
    }
    platform.secureStore.write(backupKey(userId), null)
}

fun discardCharacterDraftBackup(platform: DeviceServices, userId: Long) {
    platform.secureStore.write(backupKey(userId), null)
}

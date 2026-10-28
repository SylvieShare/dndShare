package ru.dndshare.client.character

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import ru.dndshare.client.data.*
import ru.dndshare.client.device.DeviceServices
import ru.dndshare.client.model.WireJson

@Serializable
private data class DraftBackup(
    val uuid: String,
    val payload: String,
    val draft: String,
    val forms: List<CachedSheetForm> = emptyList(),
    val commands: List<CachedSheetSection> = emptyList(),
)

private fun backupKey(userId: Long) = "character-sheet-drafts:$userId"

/** Authentication expiry clears readable caches, but retains unacknowledged work encrypted. */
suspend fun retainCharacterDrafts(
    platform: DeviceServices,
    userId: Long,
    database: ClientDatabase,
) =
    withContext(Dispatchers.IO) {
        val dao = database.characterSheets()
        val forms = dao.openForms().groupBy { it.uuid }
        val commands = dao.pendingCommands().groupBy { it.uuid }
        val rows =
            (dao.pending() + forms.keys + commands.keys).distinct().mapNotNull { uuid ->
                val row = dao.get(uuid)
                val payload =
                    row?.payload ?: forms[uuid]?.firstOrNull()?.baseline ?: return@mapNotNull null
                DraftBackup(
                    uuid,
                    payload,
                    row?.draft ?: "{}",
                    forms[uuid].orEmpty(),
                    commands[uuid].orEmpty(),
                )
            }
        if (rows.isNotEmpty())
            platform.secureStore.write(backupKey(userId), WireJson.encodeToString(rows))
    }

suspend fun restoreCharacterDrafts(
    platform: DeviceServices,
    userId: Long,
    database: ClientDatabase,
) =
    withContext(Dispatchers.IO) {
        val stored = platform.secureStore.read(backupKey(userId)) ?: return@withContext
        val rows = WireJson.decodeFromString<List<DraftBackup>>(stored)
        for (row in rows) {
            require(WireJson.decodeFromString<CharacterSheet>(row.payload).userId == userId)
            if (database.characterSheets().get(row.uuid) == null)
                database
                    .characterSheets()
                    .put(CachedCharacterSheet(row.uuid, row.payload, row.draft))
            for (form in row.forms) database.characterSheets().putForm(form)
            for (command in row.commands) database.characterSheets().putSection(command)
        }
        platform.secureStore.write(backupKey(userId), null)
    }

fun discardCharacterDraftBackup(platform: DeviceServices, userId: Long) {
    platform.secureStore.write(backupKey(userId), null)
}

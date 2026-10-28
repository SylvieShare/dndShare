package ru.dndshare.client.data

import io.ktor.http.HttpMethod
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import ru.dndshare.client.character.CharacterCommandQueue
import ru.dndshare.client.model.*
import ru.dndshare.client.network.*

class CatalogueRepository(
    private val api: ApiClient,
    val database: ClientDatabase,
    accountId: Long = 0,
) {
    private val synchronization = Mutex()
    val cache
        get() = database.cache()

    private val commandScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val commands = ConcurrentHashMap<String, CharacterCommandQueue>()

    fun commandQueue(uuid: String): CharacterCommandQueue =
        commands.getOrPut(uuid) {
            CharacterCommandQueue(
                uuid,
                database.characterSheets(),
                sheets,
                { route, body ->
                    when {
                        route == "journal" -> {
                            val response = api.journalCommand(uuid, body)
                            refreshCharacterJournal(uuid)
                            response
                        }
                        route == "media-icon" ->
                            api.setCharacterIcon(
                                uuid,
                                if (body["remove"] == JsonPrimitive(true)) null
                                else java.io.File(body.text("path")),
                            )
                        route.startsWith("session-d20/") ->
                            api.sessionD20(route.substringAfter('/'), body)
                        route.startsWith("session-event/") ->
                            api.sessionEvent(route.substringAfter('/'), body)
                        else -> api.characterRequest(uuid, route, HttpMethod.Post, body)
                    }
                },
                commandScope,
            )
        }

    suspend fun resume() {
        sheets.resume()
        database.characterSheets().pendingCommands().forEach { commandQueue(it.uuid).resume() }
    }

    suspend fun closeAndJoin() {
        commandScope.coroutineContext[Job]?.cancelAndJoin()
        sheets.closeAndJoin()
    }

    fun close() {
        commandScope.cancel()
        sheets.close()
    }

    val sheets =
        ru.dndshare.client.character.CharacterSheetRepository(
            api,
            database.characterSheets(),
            accountId,
        )

    suspend fun refreshCharacterJournal(uuid: String) {
        var response = api.characterJournal(uuid)
        if (response["journal"] == JsonNull && response["canSelectSource"] == JsonPrimitive(true)) {
            api.createCharacterJournal(uuid)
            response = api.characterJournal(uuid)
        }
        database
            .characterSheets()
            .putSection(CachedSheetSection(uuid, "journal", response.toString()))
    }

    suspend fun synchronize(sourceId: Long, progress: (Int) -> Unit) =
        withContext(Dispatchers.IO) {
            synchronization.withLock { synchronizePages(sourceId, progress) }
        }

    private suspend fun synchronizePages(sourceId: Long, progress: (Int) -> Unit) {
        var state = cache.syncState(sourceId) ?: SyncState(sourceId)
        var cursor = state.resumeCursor ?: state.cursor
        var received = 0
        var resetAttempted = false
        while (true) {
            val page =
                try {
                    api.sync(sourceId, cursor)
                } catch (error: ApiException) {
                    if (error.code != "SYNC_RESET_REQUIRED" || resetAttempted) throw error
                    resetAttempted = true
                    cursor = null
                    state = state.copy(cursor = null, resumeCursor = null)
                    cache.upsertState(state)
                    continue
                }
            require(page.protocol == 1) { "Неизвестный формат справочника." }
            require(page.entries.size <= 250) { "Слишком большая страница справочника." }
            val next =
                if (page.hasMore) requireNotNull(page.nextCursor) else requireNotNull(page.cursor)
            require(!page.hasMore || next != cursor) { "Сервер повторил курсор синхронизации." }
            if (!page.hasMore) requireNotNull(page.visibleIds)
            val updates =
                page.entries
                    .filterNot { it.deleted }
                    .map { entry ->
                        val item = requireNotNull(entry.item)
                        require(item.id == entry.id)
                        CachedItem(
                            sourceId,
                            item.id,
                            item.typeId,
                            item.name,
                            item.nameEn.orEmpty(),
                            (item.name + " " + item.nameEn.orEmpty()).lowercase(),
                            item.editionKeys(),
                            item.hidden,
                            entry.revision,
                            WireJson.encodeToString(item),
                        )
                    }
            state =
                if (page.hasMore) state.copy(resumeCursor = next)
                else
                    state.copy(
                        cursor = next,
                        resumeCursor = null,
                        lastSyncedAt = page.serverTime,
                        ready = true,
                    )
            cache.applyPage(
                sourceId,
                updates,
                page.entries.filter { it.deleted }.map { RemovedItem(it.id, it.revision) },
                page.metadata?.let { CachedMetadata(sourceId, WireJson.encodeToString(it)) },
                state,
                if (page.hasMore) null else page.visibleIds,
            )
            received += page.entries.size
            progress(received)
            cursor = next
            if (!page.hasMore) break
        }
    }

    suspend fun refreshCharacters() =
        withContext(Dispatchers.IO) {
            val characters =
                api.characters().map { CachedCharacter(it.id, WireJson.encodeToString(it)) }
            cache.replaceCharacters(characters)
            characters.isNotEmpty()
        }
}

fun searchPattern(value: String): String =
    "%" +
        value.trim().lowercase().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") +
        "%"

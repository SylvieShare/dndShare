package ru.dndshare.client.data

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import ru.dndshare.client.model.*
import ru.dndshare.client.network.*

class CatalogueRepository(private val api: ApiClient, val database: ClientDatabase) {
    private val synchronization = Mutex()
    val cache get() = database.cache()

    suspend fun synchronize(sourceId: Long, progress: (Int) -> Unit) = withContext(Dispatchers.IO) {
        synchronization.withLock { synchronizePages(sourceId, progress) }
    }

    private suspend fun synchronizePages(sourceId: Long, progress: (Int) -> Unit) {
        var state = cache.syncState(sourceId) ?: SyncState(sourceId)
        var cursor = state.resumeCursor ?: state.cursor
        var received = 0
        var resetAttempted = false
        while (true) {
            val page = try {
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
            val next = if (page.hasMore) requireNotNull(page.nextCursor) else requireNotNull(page.cursor)
            require(!page.hasMore || next != cursor) { "Сервер повторил курсор синхронизации." }
            if (!page.hasMore) requireNotNull(page.visibleIds)
            val updates = page.entries.filterNot { it.deleted }.map { entry ->
                val item = requireNotNull(entry.item)
                require(item.id == entry.id)
                CachedItem(
                    sourceId, item.id, item.typeId, item.name, item.nameEn.orEmpty(),
                    (item.name + " " + item.nameEn.orEmpty()).lowercase(),
                    item.editionKeys(), item.hidden, entry.revision, WireJson.encodeToString(item),
                )
            }
            state = if (page.hasMore) state.copy(resumeCursor = next)
            else state.copy(cursor = next, resumeCursor = null, lastSyncedAt = page.serverTime, ready = true)
            cache.applyPage(
                sourceId, updates, page.entries.filter { it.deleted }.map { RemovedItem(it.id, it.revision) },
                page.metadata?.let { CachedMetadata(sourceId, WireJson.encodeToString(it)) },
                state, if (page.hasMore) null else page.visibleIds,
            )
            received += page.entries.size
            progress(received)
            cursor = next
            if (!page.hasMore) break
        }
    }

    suspend fun refreshCharacters() = withContext(Dispatchers.IO) {
        val characters = api.characters().map { CachedCharacter(it.id, WireJson.encodeToString(it)) }
        cache.replaceCharacters(characters)
    }
}

fun searchPattern(value: String): String = "%" + value.trim().lowercase()
    .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"

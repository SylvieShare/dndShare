package ru.dndshare.client.character

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.data.CachedCharacterSheet
import ru.dndshare.client.data.CharacterSheetDao
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.network.ApiException
import java.util.concurrent.ConcurrentHashMap

interface CharacterSheetApi {
    suspend fun character(uuid: String): CharacterSheet
    suspend fun saveCharacter(uuid: String, packet: SheetPacket): SheetChange
}

class CharacterSheetRepository(
    private val api: CharacterSheetApi, private val cache: CharacterSheetDao, private val accountId: Long,
    private val scope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO),
) {
    private val locks = ConcurrentHashMap<String, Mutex>()
    private val jobs = ConcurrentHashMap<String, Job>()
    private val messages = MutableStateFlow<Map<String, String>>(emptyMap())
    fun message(uuid: String): Flow<String?> = messages.map { it[uuid] }.distinctUntilChanged()
    fun observe(uuid: String): Flow<SheetSnapshot?> = cache.observe(uuid).map { it?.snapshot() }
    private fun lock(uuid: String) = locks.getOrPut(uuid) { Mutex() }
    private fun CachedCharacterSheet.snapshot() = SheetSnapshot(
        WireJson.decodeFromString(payload), WireJson.decodeFromString(draft))
    private suspend fun put(uuid: String, sheet: CharacterSheet, draft: SheetDraft) {
        cache.put(CachedCharacterSheet(uuid, WireJson.encodeToString(sheet),
            if (draft.edits.isEmpty() && draft.sending == null && draft.blocked == null) "{}" else WireJson.encodeToString(draft)))
    }
    private fun message(uuid: String, text: String?) {
        messages.update { old -> old.toMutableMap().apply { if (text == null) remove(uuid) else put(uuid, text) } }
    }

    suspend fun refresh(uuid: String) = withContext(scope.coroutineContext) {
        val remote = api.character(uuid)
        lock(uuid).withLock {
            val existing = cache.get(uuid)?.snapshot()
            // An immutable in-flight packet must receive its own acknowledgement first.
            if (existing == null || existing.draft.edits.isEmpty()) put(uuid, remote, SheetDraft())
        }
        retry(uuid)
    }

    suspend fun enqueue(uuid: String, patches: List<SheetPatch>, expected: JsonObject? = null, formId: String? = null) = withContext(scope.coroutineContext) {
        lock(uuid).withLock {
            // A restored UI can still contain an already accepted form ID.
            if (formId != null && cache.form(uuid, formId) == null) return@withLock
            val current = requireNotNull(cache.get(uuid)).snapshot()
            require(current.sheet.userId == accountId) { "Этот лист доступен только для просмотра." }
            val requested = createSheetEdit(expected ?: current.document, patches)
            val edit = rebaseSheetEdit(requested, current.document)
                ?: error("Этот показатель изменился после открытия формы. Ваш ввод сохранён; закройте форму, чтобы проверить новое значение.")
            val draft = if (edit.patches.isEmpty()) current.draft else current.draft.copy(edits = current.draft.edits + edit)
            if (formId == null) put(uuid, current.sheet, draft)
            else cache.acceptForm(CachedCharacterSheet(uuid, WireJson.encodeToString(current.sheet),
                if (draft.edits.isEmpty() && draft.sending == null && draft.blocked == null) "{}" else WireJson.encodeToString(draft)), formId)
        }
        retry(uuid)
    }

    suspend fun resume() { cache.pending().forEach(::retry) }

    fun retry(uuid: String) {
        synchronized(jobs) {
            if (jobs[uuid]?.isActive == true) return
            val job = scope.launch(start = CoroutineStart.LAZY) {
                var drained = false
                try { drained = sendPending(uuid) }
                finally { synchronized(jobs) { jobs.remove(uuid) } }
                // An edit may have arrived between the final empty read and job completion.
                if (drained && scope.isActive) {
                    val latest = cache.get(uuid)?.snapshot()
                    if (latest?.draft?.edits?.isNotEmpty() == true && latest.draft.blocked == null) retry(uuid)
                }
            }
            jobs[uuid] = job
            job.start()
        }
    }

    suspend fun clearBlock(uuid: String) = withContext(scope.coroutineContext) {
        lock(uuid).withLock {
            val current = cache.get(uuid)?.snapshot() ?: return@withLock
            put(uuid, current.sheet, current.draft.copy(blocked = null))
        }
        retry(uuid)
    }

    /** Called only after the user chooses to discard the local draft. */
    suspend fun reload(uuid: String) = withContext(scope.coroutineContext) {
        jobs[uuid]?.cancelAndJoin()
        val remote = api.character(uuid)
        lock(uuid).withLock { put(uuid, remote, SheetDraft()) }
        message(uuid, null)
    }

    private suspend fun nextPacket(uuid: String): SheetPacket? = lock(uuid).withLock {
        val current = cache.get(uuid)?.snapshot() ?: return null
        if (current.draft.edits.isEmpty()) return null
        require(current.sheet.userId == accountId) { "Нет права изменять этот лист." }
        if (current.draft.blocked != null) return null
        val edit = current.draft.edits.firstOrNull() ?: return null
        current.draft.sending?.let { return it }
        val packet = SheetPacket(current.sheet.version, edit.id, edit.patches)
        put(uuid, current.sheet, current.draft.copy(sending = packet))
        packet
    }

    private suspend fun acknowledge(uuid: String, packet: SheetPacket, reply: SheetChange) = lock(uuid).withLock {
        val current = requireNotNull(cache.get(uuid)).snapshot()
        require(current.draft.sending == packet && current.draft.edits.first().id == packet.mutationId)
        require(reply.mutationId == packet.mutationId && reply.fromVersion == current.sheet.version)
        val next = current.sheet.copy(version = reply.version, data = applySheetPatches(current.sheet.data, reply.patches))
        put(uuid, next, current.draft.copy(edits = current.draft.edits.drop(1), sending = null))
    }

    private suspend fun rebase(uuid: String): Boolean {
        val remote = api.character(uuid)
        return lock(uuid).withLock {
            val current = requireNotNull(cache.get(uuid)).snapshot()
            val edit = rebaseSheetEdit(current.draft.edits.first(), remote.data)
            if (edit == null) {
                put(uuid, current.sheet, current.draft.copy(blocked = "Этот показатель уже изменён на другом устройстве. Ваш черновик сохранён."))
                false
            } else {
                val edits = (if (edit.patches.isEmpty()) emptyList() else listOf(edit)) + current.draft.edits.drop(1)
                put(uuid, remote, current.draft.copy(edits = edits, sending = null))
                true
            }
        }
    }

    private suspend fun block(uuid: String, text: String): Unit = lock(uuid).withLock {
        val current = cache.get(uuid)?.snapshot() ?: return@withLock
        put(uuid, current.sheet, current.draft.copy(blocked = text))
    }

    private suspend fun sendPending(uuid: String): Boolean {
        var delayMillis = 500L
        var handled = false
        while (currentCoroutineContext().isActive) {
            val packet = try { nextPacket(uuid) } catch (error: Exception) {
                if (error is CancellationException) throw error
                message(uuid, error.message ?: "Не удалось прочитать очередь изменений.")
                return false
            } ?: break
            handled = true
            try {
                acknowledge(uuid, packet, api.saveCharacter(uuid, packet))
                message(uuid, null)
                delayMillis = 500L
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) {
                if (error is ApiException && error.status == 409) {
                    try {
                        if (!rebase(uuid)) return false
                    } catch (cancelled: CancellationException) { throw cancelled }
                    catch (failed: Exception) { message(uuid, failed.message ?: "Нет связи с сервером."); delay(delayMillis) }
                } else if (error is ApiException && error.status in 400..499 && error.status != 429) {
                    block(uuid, error.message ?: "Сохранение отклонено сервером.")
                    return false
                } else {
                    message(uuid, "Нет связи. Изменения сохранены на устройстве и будут отправлены повторно.")
                    delay(delayMillis)
                    delayMillis = (delayMillis * 2).coerceAtMost(30_000)
                }
            }
        }
        message(uuid, null)
        try { if (handled) refresh(uuid) }
        catch (cancelled: CancellationException) { throw cancelled }
        catch (_: Exception) { /* The acknowledgement is already durable. */ }
        return true
    }

    fun close() { scope.cancel() }
    suspend fun closeAndJoin() { scope.coroutineContext[Job]?.cancelAndJoin() }
}

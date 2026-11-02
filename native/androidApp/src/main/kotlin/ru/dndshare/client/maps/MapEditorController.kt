package ru.dndshare.client.maps

import java.util.UUID
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*

data class MapEditorState(
    val work: MapWork? = null,
    val models: List<MapModel> = emptyList(),
    val loading: Boolean = true,
    val modelLoading: Boolean = true,
    val saving: Boolean = false,
    val error: String? = null,
    val conflict: Boolean = false,
) {
    val map
        get() = work?.current
}

class MapEditorController(private val api: MapsApi, private val store: MapWorkspaceStore) :
    AutoCloseable {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val mutable = MutableStateFlow(MapEditorState())
    val state: StateFlow<MapEditorState> = mutable.asStateFlow()
    private var debounce: Job? = null
    private var saving: Job? = null
    private var opening: Job? = null

    fun open(id: String) {
        opening?.cancel()
        opening = scope.launch {
            mutable.value = MapEditorState()
            launch { loadModels() }
            try {
                val cached = store.readWork(id)
                if (cached != null) mutable.update { it.copy(work = cached, loading = false) }
                val fresh = api.get(id)
                val work = store.open(fresh)
                mutable.update {
                    it.copy(
                        work =
                            it.work?.takeIf { current ->
                                current.dirty && current.localVersion >= work.localVersion
                            } ?: work,
                        loading = false,
                    )
                }
                if (state.value.work?.dirty == true) {
                    debounce?.cancel()
                    debounce = scope.launch {
                        delay(1200)
                        flush()
                    }
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                fail(error)
            } finally {
                mutable.update { it.copy(loading = false) }
            }
        }
    }

    private suspend fun loadModels() {
        try {
            val cached = store.models()
            if (cached != null) mutable.update { it.copy(models = cached, modelLoading = false) }
            val models = api.models()
            store.models(models)
            mutable.update { it.copy(models = models, modelLoading = false) }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            mutable.update { it.copy(modelLoading = false, error = error.message) }
        }
    }

    private fun persist(work: MapWork) {
        scope.launch {
            try {
                store.put(work)
            } catch (error: Exception) {
                fail(error)
            }
        }
    }

    private fun install(work: MapWork) {
        val next =
            work.copy(localVersion = (state.value.work?.localVersion ?: work.localVersion) + 1)
        mutable.update { it.copy(work = next, error = null) }
        persist(next)
        debounce?.cancel()
        if (!state.value.conflict && next.editBase == null)
            debounce = scope.launch {
                delay(1200)
                flush()
            }
    }

    fun change(update: (BattleMap) -> BattleMap) {
        val work = state.value.work ?: return
        if (!work.current.editable || state.value.conflict) return
        try {
            val updated = update(work.current)
            val map =
                updated.copy(document = normalizeMapDocument(updated.document, state.value.models))
            if (map.content == work.current.content) return
            require(map.name.isNotBlank() && map.name.length <= 160) {
                "Укажите название карты до 160 символов"
            }
            mapPlacements(map.document, state.value.models.associateBy { it.uuid })
            install(
                work.copy(
                    current = map,
                    undo =
                        if (work.editBase != null) work.undo
                        else
                            (work.undo + mapHistory(work.current.content, map.content)).takeLast(
                                50
                            ),
                    redo = emptyList(),
                )
            )
        } catch (error: Exception) {
            fail(error)
        }
    }

    fun document(update: (JsonObject) -> JsonObject) = change {
        it.copy(document = update(it.document))
    }

    fun undo() {
        finishEdit()
        val work = state.value.work ?: return
        val previous = work.undo.lastOrNull() ?: return
        try {
            install(
                work.copy(
                    current =
                        work.current.withContent(mapApply(work.current.content, previous.inverse)),
                    undo = work.undo.dropLast(1),
                    redo = (work.redo + previous).takeLast(50),
                )
            )
        } catch (error: Exception) {
            fail(error)
        }
    }

    fun redo() {
        finishEdit()
        val work = state.value.work ?: return
        val next = work.redo.lastOrNull() ?: return
        try {
            install(
                work.copy(
                    current =
                        work.current.withContent(mapApply(work.current.content, next.forward)),
                    undo = (work.undo + next).takeLast(50),
                    redo = work.redo.dropLast(1),
                )
            )
        } catch (error: Exception) {
            fail(error)
        }
    }

    suspend fun flush(): Boolean {
        if (state.value.work?.editBase != null) finishEdit()
        saving?.join()
        if (state.value.conflict) return false
        val work = state.value.work ?: return true
        if (!work.dirty) return true
        val packet =
            work.sending
                ?: MapPacket(
                    work.confirmed.revision,
                    UUID.randomUUID().toString(),
                    mapDiff(work.confirmed.content, work.current.content),
                )
        val prepared =
            work.copy(
                sending = packet,
                sent = work.sent ?: work.current.content,
                localVersion = work.localVersion + 1,
            )
        mutable.update { it.copy(work = prepared, saving = true, error = null) }
        // Write the exact packet before transmission. Retry after process death uses its ID.
        val task = scope.launch {
            try {
                store.put(prepared)
                val reply = api.patch(prepared.current.id, packet)
                val current = requireNotNull(state.value.work)
                val accepted =
                    mapAcknowledge(current, reply).copy(localVersion = current.localVersion + 1)
                mutable.update { it.copy(work = accepted) }
                store.put(accepted)
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutable.update {
                    it.copy(
                        error = error.message ?: "Не удалось сохранить карту",
                        conflict =
                            (error as? ru.dndshare.client.network.ApiException)?.status in
                                setOf(403, 404, 409),
                    )
                }
            } finally {
                mutable.update { it.copy(saving = false) }
            }
        }
        saving = task
        task.join()
        return state.value.work?.dirty != true
    }

    fun retry() {
        scope.launch {
            loadModels()
            flush()
        }
    }

    fun reload() {
        val id = state.value.map?.id ?: return
        scope.launch {
            saving?.join()
            mutable.update { it.copy(saving = true) }
            try {
                val fresh = api.get(id)
                val accepted = store.replace(fresh, state.value.work?.localVersion ?: 0)
                mutable.update { it.copy(work = accepted, error = null, conflict = false) }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                fail(error)
            } finally {
                mutable.update { it.copy(saving = false) }
            }
        }
    }

    suspend fun saveLocalCopy(): BattleMap {
        val work = requireNotNull(state.value.work)
        mutable.update { it.copy(saving = true, error = null) }
        try {
            val title =
                work.current.name.take(150).let {
                    if (it.lastOrNull()?.isHighSurrogate() == true) it.dropLast(1) else it
                }
            val copy = api.create(work.current.copy(id = "", revision = 0, name = "$title · копия"))
            store.open(copy)
            val current = requireNotNull(state.value.work)
            if (current.current.content == work.current.content) {
                val clean =
                    current.copy(
                        current = current.confirmed,
                        sending = null,
                        sent = null,
                        undo = emptyList(),
                        redo = emptyList(),
                        localVersion = current.localVersion + 1,
                    )
                mutable.update { it.copy(work = clean) }
                store.put(clean)
            }
            return copy
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            fail(error)
            throw error
        } finally {
            mutable.update { it.copy(saving = false) }
        }
    }

    private fun fail(error: Exception) {
        mutable.update { it.copy(error = error.message ?: "Не удалось открыть карту") }
    }

    override fun close() {
        finishEdit()
        val final = state.value.work
        debounce?.cancel()
        opening?.cancel()
        saving?.cancel()
        scope.launch {
            try {
                withContext(NonCancellable) { if (final != null) store.put(final) }
            } catch (error: Exception) {
                fail(error)
            } finally {
                scope.cancel()
            }
        }
    }

    fun beginEdit() {
        val work = state.value.work ?: return
        if (work.editBase != null || !work.current.editable || state.value.conflict) return
        debounce?.cancel()
        val next = work.copy(editBase = work.current.content, localVersion = work.localVersion + 1)
        mutable.update { it.copy(work = next) }
        persist(next)
    }

    fun finishEdit() {
        val work = state.value.work ?: return
        val base = work.editBase ?: return
        install(
            work.copy(
                editBase = null,
                undo =
                    if (base == work.current.content) work.undo
                    else (work.undo + mapHistory(base, work.current.content)).takeLast(50),
                redo = emptyList(),
            )
        )
    }
}

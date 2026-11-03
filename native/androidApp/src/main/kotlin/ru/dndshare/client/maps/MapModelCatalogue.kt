package ru.dndshare.client.maps

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonPrimitive

/** Catalogue freshness and writes cannot overwrite map save errors or newer ADMIN metadata. */
internal class MapModelCatalogue(
    private val mutable: MutableStateFlow<MapEditorState>,
    private val store: MapWorkspaceStore,
    private val request: suspend (Boolean) -> List<MapModel>,
    private val scope: CoroutineScope,
) {
    private var generation = 0L
    private val writes = Mutex()

    fun invalidate() {
        generation++
    }

    suspend fun load(force: Boolean = false) {
        try {
            val token = generation
            val cached =
                try {
                    if (mutable.value.models.isEmpty() && !mutable.value.modelsFresh) store.models()
                    else null
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    null
                }
            if (cached != null && token == generation)
                mutable.update { it.copy(models = cached, modelLoading = false) }
            refresh(force)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            /* refreshModels owns its generation and error state. */
        }
    }

    suspend fun refresh(force: Boolean = true): List<MapModel> =
        withContext(Dispatchers.Main.immediate) {
            val token = ++generation
            mutable.update { it.copy(modelRefreshing = true, modelError = null) }
            try {
                val models = request(force)
                writes.withLock {
                    if (token != generation) return@withLock mutable.value.models
                    store.models(models)
                    if (token != generation) return@withLock mutable.value.models
                    mutable.update {
                        it.copy(models = models, modelLoading = false, modelsFresh = true)
                    }
                    models
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                if (token == generation)
                    mutable.update { it.copy(modelLoading = false, modelError = error.message) }
                throw error
            } finally {
                if (token == generation) mutable.update { it.copy(modelRefreshing = false) }
            }
        }

    fun adopt(saved: MapModel) {
        generation++
        mutable.update { it.copy(modelRefreshing = false) }
        val catalogue =
            mutable.value.models.map { model ->
                if (model.uuid == saved.uuid) saved
                else if (model.collection == saved.collection && model.code == saved.code)
                    model.copy(
                        groupName = saved.groupName,
                        groupNameEn = saved.groupNameEn,
                        raw =
                            model.raw
                                .with("groupName", JsonPrimitive(saved.groupName))
                                .with("groupNameEn", JsonPrimitive(saved.groupNameEn)),
                    )
                else model
            }
        mutable.update { it.copy(models = catalogue) }
        scope.launch {
            try {
                writes.withLock { store.models(mutable.value.models) }
            } catch (error: Exception) {
                mutable.update { it.copy(modelError = error.message) }
            }
        }
    }
}

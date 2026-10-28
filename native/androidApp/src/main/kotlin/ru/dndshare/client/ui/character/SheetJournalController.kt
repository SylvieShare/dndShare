package ru.dndshare.client.ui.character

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.data.CharacterSheetDao
import ru.dndshare.client.model.WireJson

internal class SheetJournalController(
    uuid: String,
    cache: CharacterSheetDao,
    private val services: SheetServices,
    scope: CoroutineScope,
) {
    private val progress = MutableStateFlow(false to (null as String?))
    private var lastAt = 0L
    val state =
        combine(cache.observeSection(uuid, "journal"), progress) { payload, loading ->
                SheetJournalState(
                    payload?.let { WireJson.parseToJsonElement(it) as JsonObject },
                    loading.first,
                    loading.second,
                )
            }
            .flowOn(Dispatchers.Default)
            .stateIn(scope, SharingStarted.WhileSubscribed(5_000), SheetJournalState())

    suspend fun refresh() {
        if (progress.value.first) return
        progress.value = true to null
        try {
            services.refreshJournal()
            lastAt = System.currentTimeMillis()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            progress.value = false to error.message
        } finally {
            progress.value = false to progress.value.second
        }
    }

    suspend fun poll(selected: Boolean, editing: Boolean) {
        if (selected && !editing && System.currentTimeMillis() - lastAt > 15_000) refresh()
    }
}

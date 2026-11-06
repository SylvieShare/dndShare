package ru.dndshare.client.ui.character

import ru.dndshare.client.network.ApiException
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
    private val progress = MutableStateFlow(SheetJournalState())
    private var lastAt = 0L
    val state =
        combine(cache.observeSection(uuid, "journal"), progress) { payload, loading ->
                loading.copy(payload = if (loading.accessStatus == null)
                    payload?.let { WireJson.parseToJsonElement(it) as JsonObject } else null)
            }
            .flowOn(Dispatchers.Default)
            .stateIn(scope, SharingStarted.WhileSubscribed(5_000), SheetJournalState())

    suspend fun refresh() {
        if (progress.value.loading) return
        progress.value = progress.value.copy(loading = true, error = null)
        try {
            services.refreshJournal()
            progress.value = SheetJournalState()
            lastAt = System.currentTimeMillis()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            val status = (error as? ApiException)?.status?.takeIf { it == 401 || it == 403 }
            progress.value = SheetJournalState(error = error.message.takeIf { status == null }, accessStatus = status)
        } finally {
            progress.value = progress.value.copy(loading = false)
        }
    }

    suspend fun poll(selected: Boolean, editing: Boolean) {
        if (selected && !editing && progress.value.accessStatus == null && System.currentTimeMillis() - lastAt > 15_000) refresh()
    }
}

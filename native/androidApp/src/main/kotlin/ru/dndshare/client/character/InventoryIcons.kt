package ru.dndshare.client.character

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import ru.dndshare.client.device.SecureStore
import ru.dndshare.client.model.WireJson

@Serializable
data class InventoryIconPreset(
    val id: Long,
    val itemTypeId: Long,
    val name: String,
    val purpose: String,
    val imageUrl: String,
    val code: String = "",
    val sortOrder: Int = 0,
)

@Serializable data class InventoryIconsReply(val presets: List<InventoryIconPreset> = emptyList())

data class InventoryIconsState(
    val presets: List<InventoryIconPreset> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,
    val loaded: Boolean = false,
)

/**
 * Small public presentation metadata shares the encrypted local key/value cache used by templates.
 * Images remain lazy in Coil.
 */
class InventoryIconCache(
    private val fetch: suspend () -> List<InventoryIconPreset>,
    private val store: SecureStore,
    private val scope: CoroutineScope,
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO,
) {
    private val mutable = MutableStateFlow(InventoryIconsState())
    val state = mutable.asStateFlow()
    private val restore =
        scope.launch(dispatcher) {
            runCatching {
                    store.read(KEY)?.let {
                        WireJson.decodeFromString<List<InventoryIconPreset>>(it)
                    }
                }
                .getOrNull()
                ?.let { rows -> mutable.update { it.copy(presets = rows) } }
        }
    private var running: Job? = null

    @Synchronized
    fun load(force: Boolean = false) {
        if (running?.isActive == true || mutable.value.loaded && !force) return
        running =
            scope
                .launch(dispatcher, start = CoroutineStart.LAZY) {
                    restore.join()
                    mutable.update { it.copy(loading = true, error = null) }
                    try {
                        val rows = fetch()
                        mutable.value = InventoryIconsState(presets = rows, loaded = true)
                        // A failed disk write must not discard successfully fetched metadata.
                        runCatching {
                            val encoded = WireJson.encodeToString(rows)
                            if (store.read(KEY) != encoded) store.write(KEY, encoded)
                        }
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (_: Exception) {
                        mutable.update {
                            it.copy(
                                loading = false,
                                error =
                                    if (it.presets.isEmpty()) "Не удалось загрузить иконки."
                                    else
                                        "Не удалось обновить иконки. Сохранённые варианты доступны.",
                            )
                        }
                    }
                }
                .also { it.start() }
    }

    companion object {
        const val KEY = "inventory-icon-presets"
    }
}

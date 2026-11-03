package ru.dndshare.client.ui.maps

import androidx.compose.runtime.*
import kotlinx.coroutines.*
import ru.dndshare.client.maps.*

@Stable
internal class MapLibraryController(
    val api: MapsApi,
    private val store: MapWorkspaceStore,
    private val scope: CoroutineScope,
    private val navigate: (String) -> Unit,
) {
    var section by mutableStateOf("own")
        private set

    var query by mutableStateOf("")
    var tags by mutableStateOf<List<String>>(emptyList())
    var layout by mutableStateOf("grid")
    var cards by mutableStateOf<List<BattleMap>>(emptyList())
        private set

    var loading by mutableStateOf(true)
        private set

    var error by mutableStateOf<String?>(null)
        private set

    var busy by mutableStateOf<Set<String>>(emptySet())
        private set

    var pending by mutableStateOf<Pair<String, BattleMap>?>(null)
    var preview by mutableStateOf<BattleMap?>(null)
    var previewReady by mutableStateOf(false)
        private set

    var drafts by mutableStateOf<Set<String>>(emptySet())
        private set

    private var request = 0L
    private var loadJob: Job? = null
    val tagOptions
        get() = cards.flatMap { it.tags }.distinctBy { it.lowercase() }.sortedBy { it.lowercase() }

    val visible
        get() = cards.filter { map ->
            val needle = query.trim()
            tags.all { selected -> map.tags.any { it.equals(selected, true) } } &&
                (needle.isBlank() ||
                    map.name.contains(needle, true) ||
                    map.tags.any { it.contains(needle, true) })
        }

    fun select(value: String) {
        if (value != section) {
            section = value
            load()
        }
    }

    fun load(silent: Boolean = false) {
        loadJob?.cancel()
        val generation = ++request
        val key = section
        loadJob = scope.launch {
            loading = !silent
            error = null
            try {
                drafts = store.drafts().map { it.key }.toSet()
                if (!silent) {
                    cards = store.cached(key).orEmpty()
                    if (cards.isNotEmpty()) loading = false
                }
                val result = api.list(key)
                store.cache(key, result)
                if (request == generation) {
                    cards = result
                    tags = tags.filter { selected -> tagOptions.any { it.equals(selected, true) } }
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                if (request == generation) error = failure.message ?: "Не удалось загрузить карты"
            } finally {
                if (request == generation) loading = false
            }
        }
    }

    private fun act(id: String, operation: suspend () -> Unit) {
        if (id in busy) return
        busy = busy + id
        error = null
        scope.launch {
            try {
                operation()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                error = failure.message ?: "Не удалось выполнить действие"
            } finally {
                busy = busy - id
            }
        }
    }

    fun open(map: BattleMap) {
        if (map.publishedAt == null) {
            navigate(map.id)
            return
        }
        preview = map
        previewReady = false
        act(map.id) {
            val detail = api.get(map.id)
            if (preview?.id == map.id) {
                preview = detail
                previewReady = true
            }
        }
    }

    fun create() = act("new") { navigate(api.create(BattleMap()).id) }

    fun copy(map: BattleMap) = act(map.id) { navigate(api.copy(map.id).id) }

    fun subscription(map: BattleMap) =
        act(map.id) {
            api.subscribe(map.id, !map.subscribed)
            if (preview?.id == map.id) preview = preview?.copy(subscribed = !map.subscribed)
            load(true)
        }

    fun rate(map: BattleMap, rating: Int) =
        act(map.id) {
            api.rate(map.id, rating)
            load(true)
        }

    fun apply() {
        val (kind, map) = pending ?: return
        act(map.id) {
            if (kind == "delete") {
                api.delete(map.id)
                store.forget(map.id)
            } else api.publish(map.id, map.revision)
            pending = null
            load(true)
        }
    }

    fun attachPreview(map: BattleMap, preview: MapStoredPreview) {
        fun apply(row: BattleMap) =
            if (row.id == map.id && row.previewSignature == map.previewSignature)
                row.copy(
                    previewUrl = preview.url,
                    previewSignature = preview.signature,
                    previewModelsSignature = preview.modelsSignature,
                    previewStale = false,
                )
            else row
        cards = cards.map(::apply)
        this.preview = this.preview?.let(::apply)
    }

    fun close() {
        loadJob?.cancel()
        request++
    }
}

package ru.dndshare.client.ui.character

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*

data class SheetContentState(
    val metadata: HandbookMetadata = HandbookMetadata(),
    val items: Map<Long, CatalogueItem> = emptyMap(),
    val availableStates: List<CatalogueItem> = emptyList(),
)

@OptIn(ExperimentalCoroutinesApi::class)
internal class SheetContentReader(
    cache: CacheDao, snapshot: StateFlow<SheetSnapshot?>, target: Flow<String?>,
    fallbackSourceId: Long, scope: CoroutineScope,
) {
    val sourceId = snapshot.map { it?.displayed?.sourceId ?: fallbackSourceId }
        .distinctUntilChanged().stateIn(scope, SharingStarted.Eagerly, fallbackSourceId)
    private val metadata = sourceId.flatMapLatest { source -> cache.observeMetadata(source).map { row ->
        row?.let { WireJson.decodeFromString<HandbookMetadata>(it.payload) } ?: HandbookMetadata()
    } }
    private val dependencies = MutableStateFlow<List<Long>>(emptyList())
    private val ids = combine(snapshot, dependencies) { sheet, extra ->
        (sheet?.displayed?.data?.let(::referencedItems).orEmpty() + extra).distinct().sorted()
    }.distinctUntilChanged()
    private val items = combine(sourceId, ids) { source, keys -> source to keys }.flatMapLatest { (source, keys) ->
        val queries = keys.chunked(300).map { cache.observeReferencedItems(source, it) }
        if (queries.isEmpty()) flowOf(emptyMap())
        else combine(queries) { rows -> rows.flatMap { it }.associate { it.id to WireJson.decodeFromString<CatalogueItem>(it.payload) } }
    }.onEach { rows ->
        dependencies.value = rows.values.flatMap { item -> listOfNotNull(
            item.data["armor_base"].objectValue()["base_item_id"].referenceId(),
            item.data["weapon"].objectValue()["base_item_id"].referenceId(),
            item.data["on_end_effect"].referenceId()) }.distinct().sorted()
    }
    private val states = combine(sourceId, snapshot.map { it?.displayed?.sourceVersionId }.distinctUntilChanged(), target) {
            source, version, editor -> Triple(source, version, editor)
    }.flatMapLatest { (source, version, editor) ->
        if (editor == "statuses") cache.observeItems(source, 15L, version?.let { "%|$it|%" }.orEmpty(), "%", 300)
            .map { rows -> rows.map { WireJson.decodeFromString<CatalogueItem>(it.payload) } }
        else flowOf(emptyList())
    }
    val state = combine(metadata, items, states, ::SheetContentState).flowOn(Dispatchers.Default)
        .stateIn(scope, SharingStarted.WhileSubscribed(5_000), SheetContentState())
}

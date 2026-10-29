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
    val icons: InventoryIconsState = InventoryIconsState(),
    val resolvedIds: Set<Long> = emptySet(),
    val fetching: Boolean = true,
)

private data class ResolvedSheetItems(val ids: Set<Long>, val items: Map<Long, CatalogueItem>)

@OptIn(ExperimentalCoroutinesApi::class)
internal class SheetContentReader(
    cache: CacheDao,
    snapshot: StateFlow<SheetSnapshot?>,
    target: Flow<String?>,
    fallbackSourceId: Long,
    scope: CoroutineScope,
    extraIds: Flow<List<Long>> = flowOf(emptyList()),
    icons: Flow<InventoryIconsState> = flowOf(InventoryIconsState()),
    fetching: Flow<Boolean> = flowOf(false),
) {
    val sourceId =
        snapshot
            .map { it?.displayed?.sourceId ?: fallbackSourceId }
            .distinctUntilChanged()
            .stateIn(scope, SharingStarted.Eagerly, fallbackSourceId)
    private val metadata = sourceId.flatMapLatest { source ->
        cache.observeMetadata(source).map { row ->
            row?.let { WireJson.decodeFromString<HandbookMetadata>(it.payload) }
                ?: HandbookMetadata()
        }
    }
    private val dependencies = MutableStateFlow<List<Long>>(emptyList())
    private val roots =
        combine(snapshot, extraIds) { sheet, form ->
                (sheet?.displayed?.data?.let(::referencedItems).orEmpty() + form)
                    .distinct()
                    .sorted()
            }
            .distinctUntilChanged()
            .stateIn(scope, SharingStarted.Eagerly, emptyList())
    private val ids =
        combine(roots, dependencies) { root, extra ->
                (root + extra).distinct().sorted()
            }
            .distinctUntilChanged()
    private val queriedItems =
        combine(sourceId, ids) { source, keys -> source to keys }
            .flatMapLatest { (source, keys) ->
                val queries = keys.chunked(300).map { cache.observeReferencedItems(source, it) }
                if (queries.isEmpty()) flowOf(ResolvedSheetItems(emptySet(), emptyMap()))
                else
                    combine(queries) { rows ->
                        ResolvedSheetItems(
                            keys.toSet(),
                            rows
                                .flatMap { it }
                                .associate {
                                    it.id to WireJson.decodeFromString<CatalogueItem>(it.payload)
                                },
                        )
                    }
            }
    private val items =
        combine(queriedItems, snapshot, roots) { rows, sheet, root ->
            dependencies.value = sheetContentDependencies(sheet?.displayed, rows.items, root)
            rows
        }
    private val states =
        combine(
                sourceId,
                snapshot.map { it?.displayed?.sourceVersionId }.distinctUntilChanged(),
                target,
            ) { source, version, editor ->
                Triple(source, version, editor)
            }
            .flatMapLatest { (source, version, editor) ->
                if (source > 0)
                    cache
                        .observeItems(
                            source,
                            15L,
                            version?.let { "%|$it|%" }.orEmpty(),
                            "%",
                            10_000,
                        )
                        .map { rows ->
                            rows.map { WireJson.decodeFromString<CatalogueItem>(it.payload) }
                        }
                else flowOf(emptyList())
            }
    private val advancement =
        combine(snapshot, target) { value, editor -> value?.displayed to editor }
            .flatMapLatest { (sheet, editor) ->
                if (sheet == null || editor != "level") flowOf(emptyMap<Long, CatalogueItem>())
                else {
                    val settings =
                        sheet.data["settings"].objectValue()["contentSources"].objectValue()
                    val queries =
                        listOf(9L, 17L, 4L, 7L, 5L).map { type ->
                            cache.observeCharacterItems(
                                sheet.sourceId,
                                type,
                                sheet.sourceVersionId ?: 0,
                                settings["allowLegacy"] == JsonPrimitive(true),
                                settings.text("mode") == "selected",
                                (settings["ids"] ?: JsonArray(emptyList())).toString(),
                                "%",
                                100_000,
                            )
                        }
                    combine(queries) { groups ->
                        groups
                            .flatMap { it }
                            .associate {
                                it.id to WireJson.decodeFromString<CatalogueItem>(it.payload)
                            }
                    }
                }
            }
    private val effectiveItems =
        combine(items, advancement, states) { referenced, available, statuses ->
            referenced.copy(items = available + statuses.associateBy { it.id } + referenced.items)
        }
    val state =
        combine(metadata, effectiveItems, states, icons, fetching) {
                metadata,
                items,
                states,
                presets,
                fetching ->
                SheetContentState(metadata, items.items, states, presets, items.ids, fetching)
            }
            .flowOn(Dispatchers.Default)
            .stateIn(scope, SharingStarted.WhileSubscribed(5_000), SheetContentState())
}

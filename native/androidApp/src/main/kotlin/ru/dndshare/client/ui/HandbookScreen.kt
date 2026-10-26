package ru.dndshare.client.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import kotlinx.serialization.json.*
import ru.dndshare.client.app.AppState
import ru.dndshare.client.data.*
import ru.dndshare.client.device.formatServerTime
import ru.dndshare.client.model.*
import ru.dndshare.designsystem.*

@Composable
fun HandbookScreen(state: AppState, format: LayoutFormat, fold: FoldInfo?, images: ImageLoader, refresh: () -> Unit) {
    val cache = state.repository?.cache ?: return
    key(state.sourceId, state.editionId) {
        var query by rememberSaveable { mutableStateOf("") }
        var typeId by rememberSaveable { mutableLongStateOf(0L) }
        var collection by rememberSaveable { mutableStateOf(false) }
        var dictionaryId by rememberSaveable { mutableLongStateOf(0L) }
        var history by rememberSaveable { mutableStateOf(listOf<Long>()) }
        var filtersJson by rememberSaveable { mutableStateOf("{}") }
        var bookIds by rememberSaveable { mutableStateOf(emptyList<Long>()) }
        var groupBy by rememberSaveable { mutableStateOf("") }
        var filterOpen by remember { mutableStateOf(false) }
        var limit by remember(query, typeId, filtersJson, bookIds) { mutableIntStateOf(100) }
        val selected = history.lastOrNull()
        val editionKey = if (state.editionId > 0) "%|${state.editionId}|%" else ""
        val metadata by produceState(HandbookMetadata(), state.sourceId) {
            cache.observeMetadata(state.sourceId).collect { row ->
                value = row?.let { WireJson.decodeFromString<HandbookMetadata>(it.payload) } ?: HandbookMetadata()
            }
        }
        val sync by produceState<SyncState?>(null, state.sourceId) {
            cache.observeSync(state.sourceId).collect { value = it }
        }
        val counts by produceState<List<TypeCount>>(emptyList(), state.sourceId, editionKey) {
            cache.observeCounts(state.sourceId, editionKey).collect { value = it }
        }
        val booksJson = JsonArray(bookIds.map(::JsonPrimitive)).toString()
        val items by produceState<List<ItemSummary>>(emptyList(), state.sourceId, typeId, editionKey, query, limit, booksJson, filtersJson) {
            cache.observeItems(state.sourceId, typeId.takeIf { it > 0 }, editionKey, searchPattern(query), limit, booksJson, filtersJson)
                .collect { value = it }
        }
        val resultCount by produceState(0, state.sourceId, typeId, editionKey, query, booksJson, filtersJson) {
            cache.observeFilteredCount(state.sourceId, typeId.takeIf { it > 0 }, editionKey, searchPattern(query), booksJson, filtersJson)
                .collect { value = it }
        }
        val selectedType = metadata.types.firstOrNull { it.id == typeId }
        fun home() { collection = false; dictionaryId = 0; history = emptyList(); query = "" }
        fun back() {
            if (history.isNotEmpty()) history = history.dropLast(1)
            else home()
        }
        fun open(id: Long) { if (id != selected) history = history + id }
        BackHandler((selected != null || collection || dictionaryId > 0 || query.isNotBlank()) &&
            !LocalAppDrawerOpen.current && LocalAppPageActive.current, ::back)
        val primary: @Composable () -> Unit = {
            HandbookListPane(items, selectedType, metadata, selected, query, { query = it }, groupBy, { groupBy = it },
                filtersJson != "{}" || bookIds.isNotEmpty(), { filterOpen = true }, items.size == limit,
                { limit += 100 }, ::open)
        }
        val detail: @Composable () -> Unit = {
            if (selected == null) EmptyContent("${selectedType?.name ?: "Справочник"}", "Выберите объект в списке, чтобы открыть описание.")
            else ItemDetail(cache, state.sourceId, selected, metadata, images, ::back, ::open)
        }
        Column(Modifier.fillMaxSize()) {
            if (dictionaryId > 0 && selected == null) {
                HandbookDictionary(dictionaryId, metadata, ::home, ::open)
            } else if (!collection && query.isBlank() && selected == null) {
                HandbookLanding(metadata, counts, images, { typeId = it; collection = true; filtersJson = "{}"; bookIds = emptyList() },
                    { dictionaryId = it })
            } else {
                if (format != LayoutFormat.Phone || selected == null) {
                    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        TextButton(onClick = ::home) { Text("Справочник") }
                        Text("·", color = WebPalette.TextMuted)
                        Text(selectedType?.name ?: "Все коллекции", Modifier.weight(1f), style = ShareTypography.section)
                        ShareBadge(resultCount.toString())
                    }
                    Text(sync?.lastSyncedAt?.let { "Обновлено " + formatServerTime(it) } ?: "Загружаем справочник…",
                        Modifier.padding(horizontal = 20.dp, vertical = 4.dp), style = MaterialTheme.typography.labelSmall, color = WebPalette.TextMuted)
                }
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    if (format == LayoutFormat.Phone) { if (selected == null) primary() else detail() }
                    else TwoPane(fold, Modifier.fillMaxSize(), primary, detail)
                }
            }
        }
        if (filterOpen) HandbookFilters(selectedType, metadata, WireJson.parseToJsonElement(filtersJson).jsonObject, bookIds,
            { filtersJson = it.toString() }, { bookIds = it }, { filterOpen = false })
    }
}

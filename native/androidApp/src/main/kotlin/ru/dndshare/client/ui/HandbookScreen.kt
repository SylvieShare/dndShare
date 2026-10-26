package ru.dndshare.client.ui

import androidx.compose.foundation.clickable
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import ru.dndshare.client.app.AppState
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*
import ru.dndshare.client.device.formatServerTime

@Composable
fun HandbookScreen(state: AppState, format: LayoutFormat, fold: FoldInfo?, images: ImageLoader, refresh: () -> Unit) {
    val cache = state.repository?.cache ?: return
    key(state.sourceId, state.editionId) {
        var query by rememberSaveable { mutableStateOf("") }
        var typeId by rememberSaveable { mutableLongStateOf(0L) }
        var history by rememberSaveable { mutableStateOf(listOf<Long>()) }
        var limit by remember(query, typeId) { mutableIntStateOf(100) }
        val listState = rememberLazyListState()
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
        val items by produceState<List<ItemSummary>>(emptyList(), state.sourceId, typeId, editionKey, query, limit) {
            cache.observeItems(state.sourceId, typeId.takeIf { it > 0 }, editionKey, searchPattern(query), limit)
                .collect { value = it }
        }
        fun back() { history = history.dropLast(1) }
        fun open(id: Long) { if (id != selected) history = history + id }
        BackHandler(selected != null && !LocalAppDrawerOpen.current && LocalAppPageActive.current, ::back)
        val primary: @Composable () -> Unit = {
            Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(query, { query = it }, Modifier.fillMaxWidth(), singleLine = true,
                    label = { Text("Поиск по справочнику") }, leadingIcon = { AppGlyph(Glyph.Search) })
                TypeSelector(typeId, metadata.types, counts) { typeId = it }
                Text(sync?.lastSyncedAt?.let { "Обновлено " + formatServerTime(it) }
                    ?: if (state.synchronizing) "Загружаем справочник…" else "Справочник ещё не загружен",
                    style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (items.isEmpty()) {
                    if (state.synchronizing && sync?.ready != true) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                    } else Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center) {
                        Text(if (query.isNotBlank()) "Ничего не найдено" else "Пока нет записей")
                        if (sync?.ready != true) TextButton(onClick = refresh) { Text("Загрузить справочник") }
                    }
                } else LazyColumn(Modifier.fillMaxSize(), state = listState, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    items(items, key = { it.id }) { item ->
                        Surface(color = if (selected == item.id) MaterialTheme.colorScheme.secondaryContainer
                            else MaterialTheme.colorScheme.surface, shape = MaterialTheme.shapes.medium) {
                            Row(Modifier.fillMaxWidth().clickable { open(item.id) }.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(item.name, style = MaterialTheme.typography.titleSmall)
                                    Text(item.nameEn.ifBlank { metadata.types.firstOrNull { it.id == item.typeId }?.name.orEmpty() },
                                        maxLines = 1, overflow = TextOverflow.Ellipsis,
                                        style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                AppGlyph(Glyph.Chevron)
                            }
                        }
                    }
                    if (items.size == limit) item {
                        TextButton(onClick = { limit += 100 }, modifier = Modifier.fillMaxWidth()) { Text("Показать ещё") }
                    }
                }
            }
        }
        val detail: @Composable () -> Unit = {
            if (selected == null) EmptyContent("Справочник", "Выберите запись слева, чтобы открыть описание.")
            else ItemDetail(cache, state.sourceId, selected, metadata, images, ::back, ::open)
        }
        Box(Modifier.fillMaxSize().padding(if (format == LayoutFormat.Phone) 16.dp else 20.dp)) {
            if (format == LayoutFormat.Phone) {
                if (selected == null) primary() else detail()
            } else TwoPane(fold, Modifier.fillMaxSize(), primary, detail)
        }
    }
}

@Composable
private fun TypeSelector(selected: Long, types: List<ItemType>, counts: List<TypeCount>, select: (Long) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(onClick = { expanded = true }, modifier = Modifier.fillMaxWidth()) {
            Text(types.firstOrNull { it.id == selected }?.name ?: "Все категории", maxLines = 1,
                overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Text((if (selected == 0L) counts.sumOf { it.count } else counts.firstOrNull { it.typeId == selected }?.count ?: 0).toString())
        }
        DropdownMenu(expanded, { expanded = false }) {
            DropdownMenuItem(text = { Text("Все категории") }, onClick = { select(0); expanded = false })
            types.filter { type -> counts.any { it.typeId == type.id && it.count > 0 } }.sortedBy { it.name }.forEach { type ->
                DropdownMenuItem(text = { Text(type.name) }, onClick = { select(type.id); expanded = false })
            }
        }
    }
}

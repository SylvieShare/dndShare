package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import kotlinx.coroutines.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapLibraryScreen(
    api: MapsApi,
    store: MapWorkspaceStore,
    images: ImageLoader,
    padding: PaddingValues,
    open: (String) -> Unit,
) {
    var selected by rememberSaveable { mutableStateOf("own") }
    var query by rememberSaveable { mutableStateOf("") }
    var cards by remember { mutableStateOf<List<BattleMap>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var revision by remember { mutableIntStateOf(0) }
    var pending by remember { mutableStateOf<Pair<String, BattleMap>?>(null) }
    var localDrafts by remember { mutableStateOf<Set<String>>(emptySet()) }
    val scope = rememberCoroutineScope()
    fun operation(block: suspend () -> Unit) {
        if (busy) return
        busy = true
        error = null
        scope.launch {
            try {
                block()
                revision++
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (cause: Exception) {
                error = cause.message ?: "Не удалось выполнить действие"
            } finally {
                busy = false
            }
        }
    }
    LaunchedEffect(selected, revision) {
        val scopeKey = selected
        loading = true
        error = null
        try {
            localDrafts = store.drafts().map { it.key }.toSet()
            cards = store.cached(scopeKey).orEmpty()
            if (cards.isNotEmpty()) loading = false
            val result = api.list(scopeKey)
            store.cache(scopeKey, result)
            if (selected == scopeKey) cards = result
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (cause: Exception) {
            error = cause.message ?: "Не удалось загрузить карты"
        } finally {
            loading = false
        }
    }
    val visible =
        remember(cards, query) {
            cards.filter { map ->
                query.isBlank() ||
                    (map.name + " " + map.tags.joinToString(" ")).contains(
                        query.trim(),
                        ignoreCase = true,
                    )
            }
        }
    LazyVerticalGrid(
        GridCells.Adaptive(280.dp),
        Modifier.fillMaxSize(),
        contentPadding =
            PaddingValues(
                start = 20.dp,
                end = 20.dp,
                top = padding.calculateTopPadding() + 20.dp,
                bottom = padding.calculateBottomPadding() + 20.dp,
            ),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text("Карты", Modifier.weight(1f), style = ShareTypography.title)
                    ShareButton(
                        onClick = { operation { open(api.create(BattleMap()).id) } },
                        enabled = !busy,
                    ) {
                        AppGlyph(Glyph.Plus)
                        Spacer(Modifier.width(8.dp))
                        Text("Создать карту")
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("own" to "Мои", "subscriptions" to "Подписки", "catalogue" to "Каталог")
                        .forEach { (key, title) ->
                            ShareChoiceChip(selected == key, { selected = key }, { Text(title) })
                        }
                }
                ShareValueInput(
                    query,
                    { query = it },
                    "Поиск карт",
                    showLabel = false,
                    placeholder = "Название или тег…",
                    leading = { AppGlyph(Glyph.Search) },
                )
                error?.let {
                    Text(it, color = WebPalette.Danger)
                    ShareTextButton({ revision++ }) { Text("Повторить") }
                }
                if (!loading && visible.isEmpty())
                    Text(
                        if (query.isNotBlank()) "Ничего не найдено" else "Здесь пока нет карт",
                        color = WebPalette.TextMuted,
                    )
            }
        }
        if (loading)
            items(6) {
                ShareTile(framed = false) {
                    ShareSkeletonBlock(Modifier.fillMaxWidth(), 170.dp)
                    ShareSkeletonBlock(Modifier.fillMaxWidth(.7f), 20.dp)
                }
            }
        else
            items(visible, key = { it.id }) { map ->
                ShareTile(
                    onClick = { open(map.id) },
                    framed = false,
                    contentPadding = PaddingValues(12.dp),
                ) {
                    if (!map.previewUrl.isNullOrBlank())
                        AsyncImage(
                            map.previewUrl,
                            null,
                            imageLoader = images,
                            modifier = Modifier.fillMaxWidth().height(170.dp),
                            contentScale = ContentScale.Crop,
                        )
                    else
                        Box(
                            Modifier.fillMaxWidth().height(170.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            AppGlyph(Glyph.Maps, Modifier.size(46.dp))
                        }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(map.name, style = ShareTypography.group)
                            Text(
                                "${map.width.toInt()} × ${map.height.toInt()} · ${map.tileCount} плиток",
                                color = WebPalette.TextMuted,
                                style = ShareTypography.context,
                            )
                            if (map.author.isNotBlank())
                                Text(map.author, style = ShareTypography.context)
                        }
                        ShareActionMenu(
                            "Действия с картой ${map.name}",
                            buildList {
                                if (map.owned || map.subscribed)
                                    add(
                                        ShareMenuAction(
                                            "Создать копию",
                                            Glyph.Copy,
                                            { operation { open(api.copy(map.id).id) } },
                                            !busy && map.id !in localDrafts,
                                        )
                                    )
                                if (map.publishedAt != null && !map.owned)
                                    add(
                                        ShareMenuAction(
                                            if (map.subscribed) "Отписаться" else "Подписаться",
                                            Glyph.Plus,
                                            {
                                                operation { api.subscribe(map.id, !map.subscribed) }
                                            },
                                            !busy,
                                        )
                                    )
                                if (map.editable) {
                                    add(
                                        ShareMenuAction(
                                            "Опубликовать",
                                            Glyph.Link,
                                            { pending = "publish" to map },
                                            !busy && map.id !in localDrafts,
                                        )
                                    )
                                    add(
                                        ShareMenuAction(
                                            "Удалить",
                                            Glyph.Trash,
                                            { pending = "delete" to map },
                                            !busy,
                                            danger = true,
                                        )
                                    )
                                }
                            },
                        )
                    }
                    if (map.tags.isNotEmpty())
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            map.tags.forEach { ShareBadge(it) }
                        }
                    if (map.id in localDrafts) ShareBadge("Есть локальные правки")
                    if (map.publishedAt != null) {
                        Text(
                            "★ ${"%.1f".format(map.rating)} · ${map.ratingCount}",
                            style = ShareTypography.context,
                        )
                        if (!map.owned)
                            Row {
                                (1..5).forEach { rating ->
                                    ShareTextButton(
                                        onClick = {
                                            operation {
                                                api.rate(
                                                    map.id,
                                                    if (map.myRating == rating) 0 else rating,
                                                )
                                            }
                                        }
                                    ) {
                                        Text(if (rating <= map.myRating) "★" else "☆")
                                    }
                                }
                            }
                    }
                }
            }
    }
    pending?.let { (action, map) ->
        ShareAlertDialog(
            onDismissRequest = { if (!busy) pending = null },
            title = { Text(if (action == "delete") "Удалить карту?" else "Опубликовать карту?") },
            text = {
                Text(
                    if (action == "delete")
                        "Личная карта будет удалена. Копии в сессиях сохранятся."
                    else
                        "Опубликованный оригинал нельзя менять. Для редактирования можно будет создать копию."
                )
            },
            confirmButton = {
                ShareTextButton(
                    {
                        operation {
                            if (action == "delete") {
                                api.delete(map.id)
                                store.forget(map.id)
                            } else api.publish(map.id, map.revision)
                            pending = null
                        }
                    },
                    enabled = !busy,
                ) {
                    Text(if (action == "delete") "Удалить" else "Опубликовать")
                }
            },
            dismissButton = {
                ShareTextButton({ pending = null }, enabled = !busy) { Text("Отмена") }
            },
        )
    }
}

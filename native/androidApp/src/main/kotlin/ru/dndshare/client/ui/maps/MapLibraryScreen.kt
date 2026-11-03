package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.MapAssetCache
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapLibraryScreen(
    api: MapsApi,
    store: MapWorkspaceStore,
    images: ImageLoader,
    padding: PaddingValues,
    open: (String) -> Unit,
    cache: MapAssetCache,
) {
    val scope = rememberCoroutineScope()
    val navigation by rememberUpdatedState(open)
    val controller =
        remember(api, store) { MapLibraryController(api, store, scope) { navigation(it) } }
    LaunchedEffect(controller) { controller.load() }
    DisposableEffect(controller) { onDispose { controller.close() } }
    val c = controller
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val wide = maxWidth >= 760.dp
        LazyVerticalGrid(
            if (c.layout == "list") GridCells.Fixed(1) else GridCells.Adaptive(280.dp),
            Modifier.fillMaxSize(),
            contentPadding =
                PaddingValues(
                    start = 20.dp,
                    end = 20.dp,
                    top = padding.calculateTopPadding() + 20.dp,
                    bottom = padding.calculateBottomPadding() + 20.dp,
                ),
            horizontalArrangement = Arrangement.spacedBy(18.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                    FlowRow(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        itemVerticalAlignment = Alignment.CenterVertically,
                    ) {
                        for ((key, title) in
                            listOf(
                                "own" to "Мои",
                                "subscriptions" to "Подписки",
                                "catalogue" to "Каталог",
                            )) ShareChoiceChip(c.section == key, { c.select(key) }, { Text(title) })
                        ShareButton(c::create, enabled = "new" !in c.busy) {
                            AppGlyph(Glyph.Plus)
                            Text("Создать карту")
                        }
                    }
                    if (wide)
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.weight(1f)) { LibrarySearch(c) }
                            Box(Modifier.widthIn(max = 300.dp)) {
                                ShareTokenInput(c.tags, { c.tags = it }, "Теги карт", c.tagOptions)
                            }
                            LibraryLayoutButtons(c)
                        }
                    else {
                        LibrarySearch(c)
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.weight(1f)) {
                                ShareTokenInput(c.tags, { c.tags = it }, "Теги карт", c.tagOptions)
                            }
                            LibraryLayoutButtons(c)
                        }
                    }
                    c.error?.let {
                        if (c.preview == null && c.pending == null) {
                            Text(it, color = WebPalette.Danger)
                            ShareTextButton({ c.load() }) { Text("Повторить") }
                        }
                    }
                }
            }
            if (c.loading)
                items(6) {
                    ShareTile(framed = false) {
                        ShareSkeletonBlock(Modifier.fillMaxWidth(), 190.dp)
                        ShareSkeletonBlock(Modifier.fillMaxWidth(.7f), 24.dp)
                    }
                }
            else if (c.visible.isEmpty())
                item(span = { GridItemSpan(maxLineSpan) }) {
                    Column(
                        Modifier.fillMaxWidth().padding(vertical = 40.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        AppGlyph(Glyph.Maps, Modifier.size(40.dp))
                        val filtered = c.query.isNotBlank() || c.tags.isNotEmpty()
                        Text(
                            if (filtered) "Ничего не найдено"
                            else
                                when (c.section) {
                                    "own" -> "Своих карт пока нет"
                                    "subscriptions" -> "Пока нет подписок"
                                    else -> "Каталог пока пуст"
                                },
                            style = ShareTypography.group,
                        )
                        Text(
                            if (filtered) "Попробуйте изменить поиск и теги."
                            else
                                when (c.section) {
                                    "own" ->
                                        "Создайте карту или сделайте личную копию карты из подписок."
                                    "subscriptions" ->
                                        "Откройте каталог и подпишитесь на карты для своих сессий."
                                    else ->
                                        "Опубликуйте свою карту — другие смогут бесплатно использовать её."
                                },
                            color = WebPalette.TextMuted,
                            style = ShareTypography.context,
                        )
                    }
                }
            else
                items(c.visible, key = { it.id }) { map ->
                    MapLibraryEntry(
                        map,
                        c,
                        images,
                        c.layout == "list",
                        wide,
                        Modifier.animateItem(),
                    )
                }
        }
    }
    c.preview?.let { MapLibraryPreview(c, cache, store) }
    c.pending?.let { (kind, map) ->
        val busy = map.id in c.busy
        ShareAlertDialog(
            onDismissRequest = { if (!busy) c.pending = null },
            title = { Text(if (kind == "delete") "Удалить карту?" else "Опубликовать карту?") },
            text = {
                Text(
                    c.error
                        ?: if (kind == "delete")
                            "«${map.name}» исчезнет из ваших карт. Копии в сессиях сохранятся."
                        else
                            "«${map.name}» появится в бесплатном каталоге. Изменять и удалять опубликованную заготовку нельзя; для доработки создайте копию."
                )
            },
            confirmButton = {
                ShareTextButton(c::apply, enabled = !busy) {
                    Text(
                        if (busy) "Выполняем…"
                        else if (kind == "delete") "Удалить" else "Опубликовать"
                    )
                }
            },
            dismissButton = {
                ShareTextButton({ c.pending = null }, enabled = !busy) { Text("Отмена") }
            },
        )
    }
}

@Composable
private fun LibrarySearch(c: MapLibraryController) {
    ShareValueInput(
        c.query,
        { c.query = it },
        "Поиск карт",
        showLabel = false,
        placeholder = "Название или тег…",
        leading = { AppGlyph(Glyph.Search) },
    )
}

@Composable
private fun LibraryLayoutButtons(c: MapLibraryController) {
    Row {
        MapToolButton("Плитки", Glyph.LayoutGrid) { c.layout = "grid" }
        MapToolButton("Список", Glyph.List) { c.layout = "list" }
    }
}

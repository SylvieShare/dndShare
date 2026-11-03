package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
    previews: MapStoredPreviews,
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
        val compact = maxWidth < 760.dp
        LazyVerticalGrid(
            if (c.layout == "list") GridCells.Fixed(1) else GridCells.Adaptive(280.dp),
            Modifier.widthIn(max = 1500.dp).fillMaxSize().align(Alignment.TopCenter),
            contentPadding =
                PaddingValues(
                    start = if (compact) 16.dp else 28.dp,
                    end = if (compact) 16.dp else 28.dp,
                    top = padding.calculateTopPadding() + if (compact) 24.dp else 36.dp,
                    bottom = padding.calculateBottomPadding() + 20.dp,
                ),
            horizontalArrangement = Arrangement.spacedBy(18.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                    Column(
                        Modifier.padding(bottom = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text(
                            "МАСТЕРСКАЯ",
                            color = WebPalette.AccentSoft,
                            style =
                                ShareTypography.context.copy(
                                    fontSize = 10.sp,
                                    letterSpacing = 1.8.sp,
                                    fontWeight = FontWeight.Bold,
                                ),
                        )
                        Text("Карты", style = ShareTypography.title)
                        Text(
                            "Собирайте свои карты и делитесь ими в бесплатном каталоге.",
                            color = WebPalette.TextMuted,
                            style =
                                ShareTypography.context.copy(
                                    fontSize = 14.sp,
                                    lineHeight = 18.sp,
                                    fontWeight = FontWeight.Normal,
                                ),
                        )
                    }
                    FlowRow(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        itemVerticalAlignment = Alignment.CenterVertically,
                    ) {
                        ShareSlidingTabs(
                            listOf(
                                ShareNavigationItem("own", "Мои"),
                                ShareNavigationItem("subscriptions", "Подписки"),
                                ShareNavigationItem("catalogue", "Каталог"),
                            ),
                            c.section,
                            c::select,
                            "Разделы карт",
                        )
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
                            Box(Modifier.width(300.dp)) { LibrarySearch(c) }
                            Box(Modifier.width(240.dp)) {
                                ShareTokenInput(
                                    c.tags,
                                    { c.tags = it },
                                    "Теги карт",
                                    c.tagOptions,
                                    showLabel = false,
                                    placeholder = "Найти тег…",
                                    leadingIcon = null,
                                )
                            }
                            Spacer(Modifier.weight(1f))
                            LibraryLayoutButtons(c)
                        }
                    else {
                        LibrarySearch(c)
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.weight(1f)) {
                                ShareTokenInput(
                                    c.tags,
                                    { c.tags = it },
                                    "Теги карт",
                                    c.tagOptions,
                                    showLabel = false,
                                    placeholder = "Найти тег…",
                                    leadingIcon = null,
                                )
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
                        previews,
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
    )
}

@Composable
private fun LibraryLayoutButtons(c: MapLibraryController) {
    Row {
        MapToolButton("Плитки", Glyph.LayoutGrid) { c.layout = "grid" }
        MapToolButton("Список", Glyph.List) { c.layout = "list" }
    }
}

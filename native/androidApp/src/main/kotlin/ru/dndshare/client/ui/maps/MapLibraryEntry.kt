package ru.dndshare.client.ui.maps

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import coil3.ImageLoader
import coil3.compose.AsyncImage
import kotlinx.coroutines.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapLibraryEntry(
    map: BattleMap,
    c: MapLibraryController,
    images: ImageLoader,
    list: Boolean,
    wide: Boolean,
    previews: MapStoredPreviews,
    modifier: Modifier = Modifier,
) {
    ShareTile(modifier = modifier, framed = false, contentPadding = PaddingValues(12.dp)) {
        if (list) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.width(if (wide) 180.dp else 100.dp)) {
                    MapLibraryThumbnail(map, c, images, 112, previews)
                }
                Box(Modifier.weight(1f)) { MapLibraryEntryContent(map, c) }
                if (wide) Box(Modifier.widthIn(max = 280.dp)) { MapLibraryEntryActions(map, c) }
            }
            if (!wide) MapLibraryEntryActions(map, c)
        } else {
            MapLibraryThumbnail(map, c, images, 190, previews)
            MapLibraryEntryContent(map, c)
            MapLibraryEntryActions(map, c)
        }
    }
}

@Composable
private fun MapLibraryThumbnail(
    map: BattleMap,
    c: MapLibraryController,
    images: ImageLoader,
    height: Int,
    previews: MapStoredPreviews,
) {
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var generating by remember(map.id) { mutableStateOf(false) }
    LaunchedEffect(map.id, map.previewSignature, map.previewUrl, map.previewStale, lifecycle) {
        if (!map.owned || !map.previewUrl.isNullOrBlank() && !map.previewStale)
            return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            generating = true
            try {
                c.attachPreview(map, previews.ensure(map))
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                /* The card remains usable. */
            } finally {
                generating = false
            }
            awaitCancellation()
        }
    }
    var pending by remember(map.previewUrl) { mutableStateOf(!map.previewUrl.isNullOrBlank()) }
    Box(
        Modifier.fillMaxWidth()
            .height(height.dp)
            .clip(RoundedCornerShape(9.dp))
            .background(WebPalette.Background)
            .clickable { c.open(map) }
            .semantics { contentDescription = "Открыть карту ${map.name}" },
        contentAlignment = Alignment.Center,
    ) {
        if (pending || generating && map.previewUrl.isNullOrBlank())
            ShareSkeletonBlock(Modifier.fillMaxSize())
        if (map.previewUrl.isNullOrBlank()) AppGlyph(Glyph.Maps, Modifier.size(40.dp))
        else
            AsyncImage(
                mapImageUrl(map.previewUrl),
                null,
                imageLoader = images,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit,
                onSuccess = { pending = false },
                onError = { pending = false },
            )
    }
}

@Composable
private fun MapLibraryEntryContent(map: BattleMap, c: MapLibraryController) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            itemVerticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                map.name,
                Modifier.clickable { c.open(map) },
                style = ShareTypography.card.copy(fontSize = 20.sp, lineHeight = 24.sp),
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (map.publishedAt != null) AppGlyph(Glyph.Lock, Modifier.size(12.dp))
                Text(
                    if (map.publishedAt != null) "Опубликована" else "Черновик",
                    style = ShareTypography.context,
                    color = WebPalette.TextMuted,
                )
            }
        }
        if (map.author.isNotBlank())
            Text(map.author, color = WebPalette.TextMuted, style = ShareTypography.context)
        Text(
            "${map.width.toInt()} × ${map.height.toInt()} клеток · ${map.tileCount} плиток" +
                if (map.objectCount > 0) " · ${map.objectCount} объектов" else "",
            color = WebPalette.TextMuted,
            style = ShareTypography.context,
        )
        if (map.tags.isNotEmpty())
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                map.tags.forEach { ShareBadge(it) }
            }
        if (map.id in c.drafts) ShareBadge("Есть локальные правки")
        if (map.publishedAt != null) MapLibraryRating(map, c)
    }
}

@Composable
internal fun MapLibraryEntryActions(map: BattleMap, c: MapLibraryController) {
    val busy = map.id in c.busy
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) {
        if (!map.owned && map.publishedAt != null)
            ShareTonalButton({ c.subscription(map) }, enabled = !busy) {
                AppGlyph(
                    if (map.subscribed) Glyph.BookmarkCheck else Glyph.BookmarkPlus,
                    Modifier.size(16.dp),
                )
                Text(if (map.subscribed) "Отписаться" else "Подписаться")
            }
        if (map.editable)
            ShareTonalButton(
                { c.pending = "publish" to map },
                enabled = !busy && map.id !in c.drafts,
            ) {
                AppGlyph(Glyph.Globe, Modifier.size(16.dp))
                Text("Опубликовать")
            }
        if (map.owned || map.subscribed)
            MapToolButton("Создать копию карты", Glyph.Copy, !busy && map.id !in c.drafts) {
                c.copy(map)
            }
        if (map.editable)
            MapToolButton("Удалить карту", Glyph.Trash, !busy) { c.pending = "delete" to map }
    }
}

@Composable
private fun MapLibraryRating(map: BattleMap, c: MapLibraryController) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        itemVerticalAlignment = Alignment.CenterVertically,
    ) {
        Row {
            for (index in 1..5) {
                if (map.owned)
                    Text(if (index <= map.rating) "★" else "☆", color = WebPalette.AccentSoft)
                else
                    ShareTextButton(
                        { c.rate(map, index) },
                        enabled = map.id !in c.busy,
                        modifier = Modifier.semantics { contentDescription = "Оценка $index из 5" },
                    ) {
                        Text(if (index <= map.myRating) "★" else "☆", color = WebPalette.AccentSoft)
                    }
            }
        }
        Text(
            if (map.ratingCount > 0)
                "${"%.1f".format(java.util.Locale.forLanguageTag("ru"),map.rating)} · ${map.ratingCount}"
            else "Пока нет оценок",
            style = ShareTypography.context,
            color = WebPalette.TextMuted,
        )
        if (!map.owned && map.myRating > 0)
            ShareTextButton({ c.rate(map, 0) }, enabled = map.id !in c.busy) {
                Text("Снять оценку (${map.myRating})")
            }
    }
}

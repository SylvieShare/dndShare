package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import kotlinx.serialization.json.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.DesignTokens
import ru.dndshare.client.ui.designsystem.LocalChromeHeaderPadding
import ru.dndshare.client.ui.designsystem.LocalChromePadding
import ru.dndshare.client.ui.designsystem.WebPalette

@Composable
internal fun HandbookCollectionPage(
    cache: CacheDao,
    sourceId: Long,
    editionKey: String,
    destination: HandbookDestination,
    format: LayoutFormat,
    fold: FoldInfo?,
    metadata: HandbookMetadata,
    images: ImageLoader,
    query: String,
    groupBy: String,
    filtersJson: String,
    bookIds: List<Long>,
    back: () -> Unit,
    open: (Long) -> Unit,
) {
    val type = metadata.types.firstOrNull { it.id == destination.typeId }
    var limit by
        rememberSaveable(query, destination.typeId, filtersJson, bookIds) { mutableIntStateOf(100) }
    val booksJson = JsonArray(bookIds.map(::JsonPrimitive)).toString()
    val rows by
        produceState<List<ItemSummary>?>(
            null,
            sourceId,
            destination.typeId,
            editionKey,
            query,
            limit,
            booksJson,
            filtersJson,
        ) {
            cache
                .observeItems(
                    sourceId,
                    destination.typeId.takeIf { it > 0 },
                    editionKey,
                    searchPattern(query),
                    limit,
                    booksJson,
                    filtersJson,
                )
                .collect { value = it }
        }
    val items = rows.orEmpty()
    val detailStates = rememberSaveableStateHolder()
    val primary: @Composable () -> Unit = {
        HandbookListPane(
            items,
            type,
            metadata,
            destination.itemId,
            images,
            rows == null,
            groupBy,
            items.size == limit,
            { limit += 100 },
            open,
        )
    }
    val detail: @Composable () -> Unit = {
        AnimatedHandbookPage(destination, LayoutFormat.Phone) { displayed ->
            if (displayed.itemId == null)
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        "Выберите объект",
                        color = WebPalette.TextSecondary,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            else
                detailStates.SaveableStateProvider(displayed.itemId) {
                    CompositionLocalProvider(
                        LocalChromePadding provides LocalChromeHeaderPadding.current
                    ) {
                        ItemDetail(cache, sourceId, displayed.itemId, metadata, images, back, open)
                    }
                }
        }
    }
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Box(
            Modifier.widthIn(max = DesignTokens.Layout.ContentMax)
                .fillMaxHeight()
                .fillMaxWidth()
                .padding(
                    horizontal =
                        if (format == LayoutFormat.Wide) DesignTokens.Spacing.Page else 0.dp
                )
        ) {
            if (format == LayoutFormat.Phone) {
                if (destination.itemId == null) primary() else detail()
            } else TwoPane(fold, Modifier.fillMaxSize(), primary, detail)
        }
    }
}

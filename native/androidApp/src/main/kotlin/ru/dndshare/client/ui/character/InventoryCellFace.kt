package ru.dndshare.client.ui.character

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

internal fun inventoryEntryName(entry: JsonObject, items: Map<Long, CatalogueItem>) =
    entry["override"].objectValue().text("name").ifBlank {
        resolveInventoryItem(entry, items)?.name ?: "Своя вещь"
    }

@Composable
internal fun InventoryCellFace(
    entry: JsonObject,
    forceVisible: Boolean = false,
    equipped: Boolean = false,
) {
    val context = LocalCharacterSheet.current
    val itemId = (entry["magic_item_id"] ?: entry["item_id"]).referenceId()
    if (
        itemId != null &&
            context.items[itemId] == null &&
            (context.fetchingContent || context.resolvedItemIds?.let { itemId !in it } == true)
    ) {
        ShareSkeletonBlock(Modifier.fillMaxSize(), 72.dp)
        return
    }
    val item = resolveInventoryItem(entry, context.items)
    val name = inventoryEntryName(entry, context.items)
    val preset =
        if (entry["item_id"].referenceId() == null)
            context.icons.presets.firstOrNull {
                it.id == entry["icon_preset_id"].referenceId() && it.purpose == "item"
            }
        else null
    val url =
        preset?.imageUrl
            ?: item?.iconImageUrl
            ?: context.metadata.types.firstOrNull { it.id == (item?.typeId ?: 2L) }?.iconImageUrl
    var visible by remember(entry.text("uid")) { mutableStateOf(forceVisible) }
    var loaded by remember(url) { mutableStateOf(false) }
    Box(
        Modifier.fillMaxSize().onGloballyPositioned {
            visible = forceVisible || !it.boundsInWindow().isEmpty
        }
    ) {
        if (url != null && visible)
            AsyncImage(
                url,
                null,
                imageLoader = context.images,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize().padding(6.dp),
                onLoading = { loaded = false },
                onSuccess = { loaded = true },
                onError = { loaded = false },
            )
        if (!loaded)
            Text(
                name,
                Modifier.align(Alignment.Center).padding(6.dp),
                style = ShareTypography.context,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
        if (equipped)
            AppGlyph(
                Glyph.Shirt,
                Modifier.align(Alignment.BottomStart).padding(4.dp).size(12.dp),
                WebPalette.Accent,
            )
        if (entry["count"].number(1) > 1)
            Text(
                entry["count"].number(1).toString(),
                Modifier.align(Alignment.BottomEnd)
                    .padding(4.dp)
                    .background(WebPalette.Background.copy(alpha = .9f), RoundedCornerShape(5.dp))
                    .padding(horizontal = 5.dp, vertical = 1.dp),
                style = ShareTypography.context.copy(fontSize = 12.sp),
                color = WebPalette.Text,
            )
        if (
            entry["params"].objectValue()["creation"].objectValue()["expired"] ==
                JsonPrimitive(true)
        )
            Text(
                "Истёк",
                Modifier.align(Alignment.TopCenter).padding(4.dp),
                style = ShareTypography.context.copy(fontSize = 10.sp),
                color = WebPalette.Warning,
            )
    }
}

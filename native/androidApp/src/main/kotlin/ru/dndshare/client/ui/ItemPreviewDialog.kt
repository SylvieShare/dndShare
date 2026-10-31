package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import coil3.ImageLoader
import kotlinx.serialization.json.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun ItemPreviewDialog(
    cache: CacheDao,
    sourceId: Long,
    id: Long,
    metadata: HandbookMetadata,
    images: ImageLoader,
    close: () -> Unit,
    open: (Long) -> Unit,
    canGoBack: Boolean = false,
    initialItem: CatalogueItem? = null,
    instance: JsonObject? = null,
    knownItems: Map<Long, CatalogueItem> = emptyMap(),
) {
    val state = rememberItemRecord(cache, sourceId, id, initialItem)
    val overrides = instance?.get("override") as? JsonObject
    val presented =
        state.copy(
            item =
                state.item?.let { item ->
                    if (overrides == null) item
                    else
                        item.copy(
                            name =
                                (overrides["name"] as? JsonPrimitive)?.contentOrNull ?: item.name,
                            data = JsonObject(item.data + overrides),
                        )
                }
        )
    SharePreviewWindow(
        presented.item?.name ?: "Просмотр предмета",
        close,
        back = if (canGoBack) close else null,
        navigationKey = id,
    ) {
        ItemRecordView(
            presented,
            cache,
            sourceId,
            metadata,
            images,
            open,
            headerInset = if (canGoBack) 112 else 64,
            instance = instance,
            knownItems = knownItems,
        )
    }
}

package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import coil3.ImageLoader
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
) {
    val state = rememberItemRecord(cache, sourceId, id, initialItem)
    SharePreviewWindow(
        state.item?.name ?: "Просмотр предмета",
        close,
        back = if (canGoBack) close else null,
        navigationKey = id,
    ) {
        ItemRecordView(
            state,
            cache,
            sourceId,
            metadata,
            images,
            open,
            headerInset = if (canGoBack) 112 else 64,
        )
    }
}

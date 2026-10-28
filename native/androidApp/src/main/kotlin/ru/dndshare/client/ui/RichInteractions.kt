package ru.dndshare.client.ui

import androidx.compose.runtime.staticCompositionLocalOf
import coil3.ImageLoader
import ru.dndshare.client.model.HandbookMetadata

data class RichInteractions(
    val variables: Map<String, Double> = emptyMap(),
    val metadata: HandbookMetadata = HandbookMetadata(),
    val images: ImageLoader? = null,
    val roll: ((String, String) -> Unit)? = null,
)

val LocalRichInteractions = staticCompositionLocalOf { RichInteractions() }

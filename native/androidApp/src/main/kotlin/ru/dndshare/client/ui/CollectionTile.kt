package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import coil3.ImageLoader
import coil3.compose.AsyncImage
import ru.dndshare.client.model.ItemType
import ru.dndshare.designsystem.DesignTokens
import ru.dndshare.designsystem.ShareTile
import ru.dndshare.designsystem.ShareTypography
import ru.dndshare.designsystem.WebPalette

@Composable
internal fun CollectionTile(
    type: ItemType, count: Int, images: ImageLoader,
    parentName: String?, childNames: String, onClick: () -> Unit,
) {
    val color = catalogueColor(type.color)
    ShareTile(Modifier.fillMaxWidth().heightIn(min = DesignTokens.Collection.MinHeight), onClick = onClick, tint = color,
        contentPadding = PaddingValues(DesignTokens.Collection.Padding)) {
        Box(Modifier.fillMaxWidth()) {
            type.iconImageUrl?.let { url ->
                AsyncImage(url, null, imageLoader = images, contentScale = ContentScale.Fit,
                    alpha = .78f, modifier = Modifier.align(Alignment.CenterEnd).size(DesignTokens.Collection.Emblem))
            }
            // Collection padding is shared with the web tile. The minimum can grow with wrapped/scaled text.
            Column(Modifier.fillMaxWidth().heightIn(min = DesignTokens.Collection.MinHeight - DesignTokens.Collection.Padding * 2)
                .padding(end = DesignTokens.Collection.ArtInset),
                verticalArrangement = Arrangement.SpaceBetween) {
                Column(verticalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Compact)) {
                    val relation = parentName?.let { "Раздел «$it»" }
                        ?: childNames.takeIf { it.isNotBlank() }?.let { "Основной каталог" }
                    relation?.let {
                        Text(it.uppercase(), style = ShareTypography.collectionRelation, color = color)
                    }
                    Text(type.name, style = ShareTypography.collectionTitle)
                    type.description?.takeIf { it.isNotBlank() }?.let {
                        Text(it, style = ShareTypography.collectionDescription, color = WebPalette.TextMuted)
                    }
                    if (childNames.isNotBlank()) Text("Подразделы: $childNames",
                        style = ShareTypography.collectionChildren, color = WebPalette.TextSecondary)
                }
                FlowRow(Modifier.padding(top = DesignTokens.Spacing.Medium), horizontalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Xs)) {
                    Text(count.toString(), Modifier.alignByBaseline(), style = ShareTypography.collectionCount, color = color)
                    Text("записей", Modifier.alignByBaseline(), style = ShareTypography.collectionDescription, color = WebPalette.TextMuted)
                }
            }
        }
    }
}

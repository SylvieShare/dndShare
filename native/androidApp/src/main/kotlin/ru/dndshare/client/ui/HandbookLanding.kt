package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import ru.dndshare.client.data.TypeCount
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun HandbookLanding(
    metadata: HandbookMetadata, counts: List<TypeCount>, images: ImageLoader,
    openCollection: (Long) -> Unit, openDictionary: (Long) -> Unit,
) {
    val countMap = counts.associate { it.typeId to it.count }
    val visibleTypes = metadata.types.filter { it.id !in setOf(16L, 17L) && (it.id != 18L || (countMap[it.id] ?: 0) > 0) }
    val groups = collectionGroups(visibleTypes)
    Box(Modifier.fillMaxSize().shareCanvas(), contentAlignment = Alignment.TopCenter) {
        BoxWithConstraints(Modifier.widthIn(max = DesignTokens.Layout.ContentMax).fillMaxSize().padding(horizontal = DesignTokens.Spacing.Page)) {
            val columns = when { maxWidth >= DesignTokens.Layout.Desktop -> 3; maxWidth >= DesignTokens.Layout.Tablet -> 2; else -> 1 }
            LazyVerticalGrid(GridCells.Fixed(columns), Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = DesignTokens.Spacing.Page),
                horizontalArrangement = Arrangement.spacedBy(DesignTokens.Collection.GridGap), verticalArrangement = Arrangement.spacedBy(DesignTokens.Collection.GridGap)) {
                groups.forEach { group ->
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        ShareSection(group.name, Modifier.padding(top = 12.dp), count = group.types.size) { }
                    }
                    items(group.types, key = { "type-${it.id}" }) { type ->
                        CollectionTile(
                            type = type, count = countMap[type.id] ?: 0, images = images,
                            parentName = visibleTypes.firstOrNull { it.id == type.parentTypeId }?.name,
                            childNames = visibleTypes.filter { it.parentTypeId == type.id }.joinToString(" · ") { it.name },
                            onClick = { openCollection(type.id) },
                        )
                    }
                }
                if (metadata.suggestTypes.isNotEmpty()) {
                    item(span = { GridItemSpan(maxLineSpan) }) {
                        ShareSection("Словари", Modifier.padding(top = 16.dp), metadata.suggestTypes.size, prominent = true) { }
                    }
                    items(metadata.suggestTypes, key = { "dictionary-${it.id}" }) { dictionary ->
                        ShareTile(Modifier.fillMaxWidth(), onClick = { openDictionary(dictionary.id) }) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(DesignTokens.Collection.GridGap)) {
                                if (dictionary.svg != null) AsyncImage(remember(dictionary.svg) { dictionary.svg.toByteArray() }, null, imageLoader = images,
                                    colorFilter = ColorFilter.tint(catalogueColor(dictionary.color)), modifier = Modifier.size(32.dp))
                                else ShareBadge(dictionary.name.take(1), color = catalogueColor(dictionary.color))
                                Column(Modifier.weight(1f)) {
                                    Text(dictionary.name, style = MaterialTheme.typography.titleSmall)
                                    Text("${metadata.suggests[dictionary.id.toString()]?.size ?: 0} записей",
                                        style = MaterialTheme.typography.bodySmall, color = WebPalette.TextMuted)
                                }
                                AppGlyph(Glyph.Chevron, Modifier.size(16.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

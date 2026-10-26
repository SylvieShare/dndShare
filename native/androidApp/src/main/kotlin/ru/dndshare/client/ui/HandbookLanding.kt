package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import ru.dndshare.client.data.TypeCount
import ru.dndshare.client.model.*
import ru.dndshare.designsystem.*

@Composable
internal fun HandbookLanding(
    metadata: HandbookMetadata, counts: List<TypeCount>, images: ImageLoader,
    openCollection: (Long) -> Unit, openDictionary: (Long) -> Unit,
) {
    val countMap = counts.associate { it.typeId to it.count }
    val groups = collectionGroups(metadata.types.filter { it.id !in setOf(16L, 17L) && (it.id != 18L || (countMap[it.id] ?: 0) > 0) })
    val cardHeight = 220.dp * LocalDensity.current.fontScale.coerceAtLeast(1f)
    BoxWithConstraints(Modifier.fillMaxSize()) {
    val columns = when { maxWidth >= 960.dp -> 3; maxWidth >= 560.dp -> 2; else -> 1 }
    LazyVerticalGrid(GridCells.Fixed(columns), Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("${metadata.types.size} коллекций · ${counts.sumOf { it.count }} записей · только чтение",
                    style = MaterialTheme.typography.bodySmall, color = WebPalette.TextMuted)
                Spacer(Modifier.height(4.dp))
                ShareAction("Все записи", { openCollection(0) }, icon = Glyph.Book)
            }
        }
        item(span = { GridItemSpan(maxLineSpan) }) { ShareSection("Коллекции", prominent = true, count = metadata.types.size) { } }
        groups.forEach { group ->
            item(span = { GridItemSpan(maxLineSpan) }) {
                ShareSection(group.name, Modifier.padding(top = 12.dp), count = group.types.size) { }
            }
            items(group.types, key = { "type-${it.id}" }) { type ->
                ShareTile(Modifier.fillMaxWidth().height(cardHeight), onClick = { openCollection(type.id) }, tint = catalogueColor(type.color)) {
                    val color = catalogueColor(type.color)
                    Box(Modifier.fillMaxWidth().weight(1f)) {
                        if (type.iconImageUrl != null) AsyncImage(type.iconImageUrl, null, imageLoader = images,
                            contentScale = ContentScale.Fit, modifier = Modifier.align(Alignment.TopEnd).size(100.dp))
                        Column(Modifier.padding(end = if (type.iconImageUrl != null) 108.dp else 0.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            val parent = metadata.types.firstOrNull { it.id == type.parentTypeId }
                            if (parent != null) Text("Раздел «${parent.name}»", style = MaterialTheme.typography.labelSmall, color = color)
                            Text(type.name, style = ShareTypography.card, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            type.description?.takeIf { it.isNotBlank() }?.let {
                                Text(it, style = MaterialTheme.typography.bodySmall, color = WebPalette.TextMuted, maxLines = 3, overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text((countMap[type.id] ?: 0).toString(), style = MaterialTheme.typography.headlineLarge,
                            fontWeight = FontWeight.SemiBold, color = color)
                        Text("записей", Modifier.padding(bottom = 4.dp), style = MaterialTheme.typography.bodySmall, color = WebPalette.TextMuted)
                    }
                }
            }
        }
        if (metadata.suggestTypes.isNotEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                ShareSection("Словари", Modifier.padding(top = 16.dp), metadata.suggestTypes.size, prominent = true) { }
            }
            items(metadata.suggestTypes, key = { "dictionary-${it.id}" }) { dictionary ->
                ShareTile(Modifier.fillMaxWidth(), onClick = { openDictionary(dictionary.id) }) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
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

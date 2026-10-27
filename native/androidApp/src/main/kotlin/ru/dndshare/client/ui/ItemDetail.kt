package ru.dndshare.client.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
fun ItemDetail(cache: CacheDao, sourceId: Long, id: Long, metadata: HandbookMetadata,
    images: ImageLoader, back: () -> Unit, open: (Long) -> Unit) {
    var resolved by remember(sourceId, id) { mutableStateOf(false) }
    val payload by produceState<String?>(null, sourceId, id) {
        cache.observeItem(sourceId, id).collect { value = it; resolved = true }
    }
    val item = remember(payload) { payload?.let { WireJson.decodeFromString<CatalogueItem>(it) } }
    Surface(Modifier.fillMaxSize(), color = WebPalette.Background, border = BorderStroke(1.dp, WebPalette.Border)) {
        if (!resolved) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        else if (item == null) EmptyContent("Запись недоступна", "Она могла быть удалена или ещё не загрузилась.")
        else key(id) {
            val record = item
            val type = metadata.types.firstOrNull { it.id == record.typeId }
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                ItemCover(record, type, metadata, images, back)
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    val fields = (type?.fields as? kotlinx.serialization.json.JsonArray).orEmpty()
                    val narrative = fields.filter { (it as? kotlinx.serialization.json.JsonObject)?.text("type") in setOf("description", "text", "textarea", "blocks") }
                    val technical = fields - narrative.toSet()
                    SchemaFields(kotlinx.serialization.json.JsonArray(narrative), record.data, metadata, cache, sourceId, open)
                    if (technical.isNotEmpty()) ShareDetailSection("Характеристики", collapsible = true, defaultOpen = false) {
                        SchemaFields(kotlinx.serialization.json.JsonArray(technical), record.data, metadata, cache, sourceId, open)
                    }
                    if (record.contentSources.isNotEmpty()) ShareSection("Источники") {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            record.contentSources.forEach { ShareBadge(it.name, color = WebPalette.TextSecondary) }
                        }
                    }
                    HorizontalDivider()
                    Text("ID ${record.id}", style = MaterialTheme.typography.labelSmall, color = WebPalette.TextMuted)
                }
            }
        }
    }
}

@Composable
private fun ItemCover(item: CatalogueItem, type: ItemType?, metadata: HandbookMetadata, images: ImageLoader, back: () -> Unit) {
    val cover = item.coverImageUrl ?: item.iconImageUrl ?: type?.coverImageUrl
    val stats = remember(item, metadata) { itemStats(type, item, metadata) }
    Box(Modifier.fillMaxWidth().heightIn(min = if (cover != null) 300.dp else 210.dp)) {
        if (cover != null) AsyncImage(cover, null, imageLoader = images, contentScale = ContentScale.Crop, modifier = Modifier.matchParentSize())
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(listOf(
            WebPalette.Background.copy(alpha = if (cover != null) .25f else 1f),
            WebPalette.Background.copy(alpha = .65f), WebPalette.Background))))
        Column(Modifier.fillMaxWidth().padding(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                ShareAction("Назад", back, icon = Glyph.Back)
                item.contentSources.firstOrNull()?.let { ShareBadge(it.code.ifBlank { it.name }, color = WebPalette.TextSecondary) }
            }
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(item.name, style = ShareTypography.title)
                item.nameEn?.takeIf { it.isNotBlank() }?.let {
                    Text(it.replace('_', ' '), style = MaterialTheme.typography.bodyMedium, color = WebPalette.TextSecondary)
                }
                type?.let { ShareBadge(it.name, color = catalogueColor(it.color)) }
            }
            if (stats.isNotEmpty()) ShareStats(stats)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if ((item.data["concentration"] as? kotlinx.serialization.json.JsonPrimitive)?.content == "true") ShareBadge("Концентрация", color = WebPalette.Success)
                if ((item.data["ritual"] as? kotlinx.serialization.json.JsonPrimitive)?.content == "true") ShareBadge("Ритуал", color = WebPalette.Warning)
            }
        }
    }
}

package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

internal data class CataloguePreviewContext(
    val cache: CacheDao? = null,
    val sourceId: Long = 0,
    val items: Map<Long, CatalogueItem> = emptyMap(),
    val instance: JsonObject? = null,
    val images: ImageLoader? = null,
)

internal val LocalCataloguePreview = staticCompositionLocalOf { CataloguePreviewContext() }

@Composable
internal fun EquipmentReference(
    id: Long,
    metadata: HandbookMetadata,
    open: (Long) -> Unit,
    count: Int = 1,
) {
    val context = LocalCataloguePreview.current
    val state =
        if (context.cache != null)
            rememberItemRecord(context.cache, context.sourceId, id, context.items[id])
        else ItemRecordState(context.items[id], true)
    when {
        !state.resolved -> ShareSkeletonBlock(Modifier.fillMaxWidth().height(74.dp))
        state.item == null ->
            ShareTile(framed = false) {
                Text("Связанная запись недоступна", color = WebPalette.TextMuted)
                ShareTextButton(state.retry) { Text("Повторить") }
            }
        else -> {
            val item = state.item
            val attack = item.data["attacks"].arrayValue().firstOrNull().objectValue()
            val die = catalogueDieSides(attack["dice_id"], metadata)
            val dieColor = runCatching {
                Color(
                    android.graphics.Color.parseColor(
                        metadata.suggest(attack["type"].referenceId() ?: 0, 12)?.color.orEmpty()
                    )
                )
            }.getOrDefault(WebPalette.Warning)
            val damageType =
                metadata.suggest(attack["type"].referenceId() ?: 0, 12)?.value.orEmpty()
            val tags =
                item.data["tags"].arrayValue().mapNotNull {
                    metadata.suggest(it.referenceId() ?: 0, 14)?.value
                }
            ShareTile(
                onClick = { open(id) },
                framed = false,
                contentPadding = PaddingValues(10.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    val icon = item.iconImageUrl ?: item.svg?.toByteArray()
                    if (icon != null && context.images != null)
                        AsyncImage(
                            icon,
                            null,
                            imageLoader = context.images,
                            modifier = Modifier.size(48.dp),
                        )
                    if (die in setOf(4, 6, 8, 10, 12, 20, 100))
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (attack["count"].number(1) > 1)
                                    Text(attack["count"].number().toString())
                                ShareDie(
                                    requireNotNull(die),
                                    die.toString(),
                                    color = dieColor,
                                    size = 26.dp,
                                )
                            }
                            Text(
                                "УРОН",
                                style = ShareTypography.context,
                                color = WebPalette.TextMuted,
                            )
                        }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(
                            if (count > 1) "${item.name} × $count" else item.name,
                            style = ShareTypography.section,
                        )
                        val detail =
                            (listOf(damageType) + tags)
                                .filter(String::isNotBlank)
                                .joinToString(" · ")
                        if (detail.isNotBlank())
                            Text(
                                detail,
                                style = ShareTypography.context,
                                color = WebPalette.TextSecondary,
                            )
                    }
                    catalogueCost(item.data["cost"], metadata).takeIf(String::isNotBlank)?.let {
                        Text(it, style = ShareTypography.context, color = WebPalette.TextMuted)
                    }
                    AppGlyph(Glyph.Chevron, Modifier.size(16.dp), WebPalette.TextMuted)
                }
            }
        }
    }
}

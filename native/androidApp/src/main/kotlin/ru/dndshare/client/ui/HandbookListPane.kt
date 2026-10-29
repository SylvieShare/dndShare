package ru.dndshare.client.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.data.ItemSummary
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun HandbookListPane(
    rows: List<ItemSummary>,
    type: ItemType?,
    metadata: HandbookMetadata,
    selected: Long?,
    images: ImageLoader,
    loading: Boolean,
    groupBy: String,
    hasMore: Boolean,
    more: () -> Unit,
    open: (Long) -> Unit,
) {
    val listState = rememberLazyListState()
    val entries =
        remember(rows) { rows.map { WireJson.decodeFromString<CatalogueItem>(it.payload) } }
    val groupFields = handbookGroupFields(type)
    var expanded by rememberSaveable(groupBy, type?.id) { mutableStateOf(emptyList<String>()) }
    val sections =
        remember(entries, groupBy, metadata) {
            if (groupBy.isBlank()) mapOf("" to entries)
            else
                entries
                    .groupBy { item ->
                        val field =
                            groupFields.firstOrNull { it.text("key") == groupBy }
                                ?: JsonObject(emptyMap())
                        readableValue(schemaPath(item.data, groupBy), field, metadata).ifBlank {
                            "Не указано"
                        }
                    }
                    .toSortedMap(
                        if (groupBy.endsWith("cr") || groupBy.endsWith("lvl"))
                            compareBy<String> { numericGroup(it) }.thenBy { it }
                        else compareBy { it }
                    )
        }
    Surface(
        Modifier.fillMaxSize(),
        color = WebPalette.Background,
    ) {
        Column {
            LazyColumn(
                Modifier.weight(1f),
                state = listState,
                contentPadding =
                    PaddingValues(
                        start = DesignTokens.List.RowMargin,
                        end = DesignTokens.List.RowMargin,
                        top =
                            LocalChromePadding.current.calculateTopPadding() +
                                DesignTokens.List.BodyTop,
                        bottom =
                            LocalChromePadding.current.calculateBottomPadding() +
                                DesignTokens.List.BodyBottom,
                    ),
                verticalArrangement = Arrangement.spacedBy(DesignTokens.List.RowGap),
            ) {
                sections.forEach { (label, entries) ->
                    if (label.isNotBlank())
                        item(key = "group:$label") {
                            Row(
                                Modifier.fillMaxWidth()
                                    .heightIn(min = 48.dp)
                                    .clickable(role = Role.Button) {
                                        expanded =
                                            if (label in expanded) expanded - label
                                            else expanded + label
                                    }
                                    .semantics {
                                        stateDescription =
                                            if (label in expanded) "Раскрыто" else "Свернуто"
                                    },
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                val rotation by
                                    animateFloatAsState(
                                        if (label in expanded) 90f else 0f,
                                        label = "Group expansion",
                                    )
                                AppGlyph(Glyph.Chevron, Modifier.size(13.dp).rotate(rotation))
                                Text(label, style = MaterialTheme.typography.titleSmall)
                                ShareBadge(
                                    entries.size.toString(),
                                    color = WebPalette.TextSecondary,
                                )
                                HorizontalDivider(Modifier.weight(1f))
                            }
                        }
                    if (label.isBlank() || label in expanded)
                        items(entries, key = { it.id }) { item ->
                            val itemType = metadata.types.firstOrNull { it.id == item.typeId }
                            val row =
                                remember(item, metadata) { handbookRow(item, itemType, metadata) }
                            ShareContentRow(
                                item.name,
                                row.alternate,
                                row.subtitle,
                                item.id == selected,
                                { open(item.id) },
                                modifier = Modifier.animateItem(),
                                metric = row.metric,
                                metricColor =
                                    when {
                                        item.typeId == 6L -> WebPalette.Danger
                                        item.typeId == 5L && row.metric == "—" -> WebPalette.Accent
                                        else -> WebPalette.AccentSoft
                                    },
                                icon = {
                                    row.imageUrl?.let {
                                        AsyncImage(
                                            it,
                                            null,
                                            imageLoader = images,
                                            contentScale = ContentScale.Fit,
                                            modifier = Modifier.size(DesignTokens.List.Icon),
                                        )
                                    }
                                },
                                trailing = {
                                    row.badges.forEach { badge ->
                                        ShareBadge(
                                            badge,
                                            color =
                                                if (badge == "Р") WebPalette.Success
                                                else WebPalette.AccentSoft,
                                        )
                                    }
                                    if (row.trailing.isNotBlank())
                                        Text(
                                            row.trailing,
                                            style = MaterialTheme.typography.labelMedium,
                                            color = WebPalette.TextSecondary,
                                            maxLines = 1,
                                        )
                                },
                            )
                        }
                }
                if (loading)
                    item {
                        Box(
                            Modifier.fillMaxWidth().padding(24.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator()
                        }
                    }
                else if (rows.isEmpty())
                    item {
                        EmptyContent(
                            "Ничего не найдено",
                            "Попробуйте другое название или снимите фильтры.",
                        )
                    }
                if (hasMore) item { ShareAction("Показать ещё", more, Modifier.fillMaxWidth()) }
            }
        }
    }
}

internal fun handbookGroupFields(type: ItemType?): List<JsonObject> =
    schemaLeaves(type?.fields as? JsonArray ?: JsonArray(emptyList()))
        .filter { (_, field) -> (field["group"] as? JsonPrimitive)?.booleanOrNull == true }
        .map { (path, field) -> JsonObject(field + ("key" to JsonPrimitive(path))) }

package ru.dndshare.client.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.data.ItemSummary
import ru.dndshare.client.model.*
import ru.dndshare.designsystem.*

@Composable
internal fun HandbookListPane(
    rows: List<ItemSummary>, type: ItemType?, metadata: HandbookMetadata, selected: Long?,
    query: String, search: (String) -> Unit, groupBy: String, group: (String) -> Unit,
    filtered: Boolean, filters: () -> Unit, hasMore: Boolean, more: () -> Unit, open: (Long) -> Unit,
) {
    val listState = rememberLazyListState()
    val entries = remember(rows) { rows.map { WireJson.decodeFromString<CatalogueItem>(it.payload) } }
    val groupFields = schemaLeaves(type?.fields as? JsonArray ?: JsonArray(emptyList()))
        .filter { (_, field) -> (field["group"] as? JsonPrimitive)?.booleanOrNull == true }
        .map { (path, field) -> JsonObject(field + ("key" to JsonPrimitive(path))) }
    var collapsed by rememberSaveable(groupBy, type?.id) { mutableStateOf(emptyList<String>()) }
    val sections = remember(entries, groupBy, metadata) {
        if (groupBy.isBlank()) mapOf("" to entries) else entries.groupBy { item ->
            val field = groupFields.firstOrNull { it.text("key") == groupBy } ?: JsonObject(emptyMap())
            readableValue(schemaPath(item.data, groupBy), field, metadata).ifBlank { "Не указано" }
        }.toSortedMap(if (groupBy.endsWith("cr") || groupBy.endsWith("lvl")) compareBy<String> { numericGroup(it) }.thenBy { it }
            else compareBy { it })
    }
    Surface(Modifier.fillMaxSize(), color = WebPalette.Background, border = BorderStroke(1.dp, WebPalette.Border)) {
        Column {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                ShareSearch(query, search, placeholder = "Поиск по справочнику")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ShareAction("Фильтры и источники", filters, active = filtered, icon = Glyph.Filter)
                    if (groupFields.isNotEmpty()) {
                        var expanded by remember { mutableStateOf(false) }
                        Box {
                            ShareAction("Группировка", { expanded = true }, active = groupBy.isNotBlank())
                            DropdownMenu(expanded, { expanded = false }) {
                                DropdownMenuItem(text = { Text("Без группировки") }, onClick = { group(""); expanded = false })
                                groupFields.forEach { field -> DropdownMenuItem(text = { Text(field.text("name")) },
                                    onClick = { group(field.text("key")); expanded = false }) }
                            }
                        }
                    }
                }
            }
            HorizontalDivider()
            LazyColumn(Modifier.weight(1f), state = listState, contentPadding = PaddingValues(12.dp),
                verticalArrangement = Arrangement.spacedBy(5.dp)) {
                sections.forEach { (label, entries) ->
                    if (label.isNotBlank()) item(key = "group:$label") {
                        Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(role = Role.Button) {
                            collapsed = if (label in collapsed) collapsed - label else collapsed + label
                        }.semantics { stateDescription = if (label in collapsed) "Свернуто" else "Раскрыто" },
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            AppGlyph(Glyph.Chevron, Modifier.size(16.dp).rotate(if (label in collapsed) 0f else 90f))
                            Text(label, style = MaterialTheme.typography.titleSmall)
                            ShareBadge(entries.size.toString(), color = WebPalette.TextSecondary)
                            HorizontalDivider(Modifier.weight(1f))
                        }
                    }
                    if (label !in collapsed) items(entries, key = { it.id }) { item ->
                        val itemType = metadata.types.firstOrNull { it.id == item.typeId }
                        val (metric, subtitle, badges) = remember(item, metadata) { rowIdentity(item, itemType, metadata) }
                        ShareContentRow(item.name, item.nameEn.orEmpty(), subtitle.ifBlank { if (type == null) itemType?.name.orEmpty() else "" },
                            item.id == selected, { open(item.id) }, metric = metric, badges = badges)
                    }
                }
                if (rows.isEmpty()) item { EmptyContent("Ничего не найдено", "Попробуйте другое название или снимите фильтры.") }
                if (hasMore) item { ShareAction("Показать ещё", more, Modifier.fillMaxWidth()) }
            }
        }
    }
}

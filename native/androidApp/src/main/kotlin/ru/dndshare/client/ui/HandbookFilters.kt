package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun HandbookFilters(
    type: ItemType?, metadata: HandbookMetadata, selected: JsonObject, books: List<Long>,
    update: (JsonObject) -> Unit, updateBooks: (List<Long>) -> Unit, dismiss: () -> Unit,
) {
    AlertDialog(onDismissRequest = dismiss, title = { Text("Фильтры и источники", style = ShareTypography.section) },
        confirmButton = { TextButton(onClick = dismiss) { Text("Готово") } },
        dismissButton = { TextButton(onClick = { update(JsonObject(emptyMap())); updateBooks(emptyList()) }) { Text("Сбросить") } },
        text = {
            Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                filterFields(type?.fields as? JsonArray ?: JsonArray(emptyList())).forEach { (path, field) ->
                    val options = filterChoices(field, metadata)
                    if (options.isNotEmpty()) ShareSection(field.text("name").ifBlank { path }) {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            options.forEach { (value, label) ->
                                val values = (selected[path] as? JsonArray)?.toList().orEmpty()
                                ShareAction(label, {
                                    val next = if (value in values) values - value else values + value
                                    update(JsonObject(selected.toMutableMap().apply { if (next.isEmpty()) remove(path) else put(path, JsonArray(next)) }))
                                }, active = value in values)
                            }
                        }
                    }
                }
                ShareSection("Источники") {
                    metadata.books.forEach { book ->
                        ShareAction(book.name, { updateBooks(if (book.id in books) books - book.id else books + book.id) },
                            active = book.id in books)
                    }
                    if (metadata.books.isEmpty()) Text("Источники для этой системы не указаны")
                }
            }
        })
}

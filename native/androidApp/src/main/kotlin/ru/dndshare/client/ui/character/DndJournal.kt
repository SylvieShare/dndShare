package ru.dndshare.client.ui.character

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun DndJournal() {
    val context = LocalCharacterSheet.current
    val response = context.journal.payload
    val journal = response?.get("journal") as? JsonObject
    if (context.journal.loading && journal == null) LinearProgressIndicator()
    context.journal.error?.let {
        Text(it, color = WebPalette.Warning, style = ShareTypography.context)
    }
    if (journal != null) JournalWorkspace(journal, response)
    else if (!context.journal.loading)
        ShareAction("Повторить загрузку дневника", { context.edit("journal-refresh") })
    ShareTile(
        Modifier.fillMaxWidth(),
        framed = false,
        onClick = if (context.canEdit) ({ context.edit("notes") }) else null,
    ) {
        Text("Заметки", style = ShareTypography.card)
        SheetDescription(context.sheet.values.text("notes"))
    }
}

@Composable
private fun JournalWorkspace(journal: JsonObject, response: JsonObject) {
    val context = LocalCharacterSheet.current
    val canEdit = response["canEdit"] == JsonPrimitive(true) && context.canEdit
    val personal = journal.text("kind") == "personal"
    val sections = journal["sections"].arrayValue().map { it.objectValue() }
    var sectionId by rememberSaveable(journal.text("uuid")) { mutableStateOf<Long?>(null) }
    var filter by rememberSaveable(journal.text("uuid")) { mutableStateOf("all") }
    var ordering by rememberSaveable(journal.text("uuid")) { mutableStateOf(false) }
    val section =
        sections.firstOrNull { it["id"].referenceId() == sectionId } ?: sections.lastOrNull()
    var info by remember { mutableStateOf<JsonObject?>(null) }
    ShareTile(Modifier.fillMaxWidth(), framed = false) {
        Text(journal.text("name").ifBlank { "Дневник" }, style = ShareTypography.card)
        val sources = response["sources"].arrayValue().map { it.objectValue() }
        if (sources.any { it.text("kind") == "session" })
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                sources.forEach { source ->
                    FilterChip(
                        journal.text("uuid") == source.text("uuid"),
                        { context.edit("journal-source:${source.text("uuid")}") },
                        label = {
                            Text(
                                if (source.text("kind") == "personal") "Личный"
                                else source.text("sessionName").ifBlank { source.text("name") }
                            )
                        },
                        enabled = context.canEdit,
                    )
                }
            }
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            sections.forEach { row ->
                FilterChip(
                    row["id"] == section?.get("id"),
                    { sectionId = row["id"].referenceId() },
                    label = {
                        Text(
                            listOf(
                                    row["number"]?.jsonPrimitive?.content,
                                    row.text("title").ifBlank { "Раздел" },
                                    row.text("date").takeIf(String::isNotBlank),
                                )
                                .filterNotNull()
                                .joinToString(" · ")
                        )
                    },
                )
            }
        }
        if (canEdit && personal)
            TextButton(onClick = { context.edit("journal-section:new") }) { Text("Новый раздел") }
    }
    ShareTile(Modifier.fillMaxWidth(), framed = false) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("all" to "Всё", "quest" to "Задания", "dialog" to "Диалоги").forEach {
                (key, title) ->
                FilterChip(filter == key, { filter = key }, label = { Text(title) })
            }
            if (canEdit && section != null) {
                TextButton(
                    onClick = {
                        context.edit("journal-entry:new:${section["id"].referenceId()}:event")
                    }
                ) {
                    Text("Добавить запись")
                }
                if (personal)
                    TextButton(
                        onClick = { context.edit("journal-section:${section["id"].referenceId()}") }
                    ) {
                        Text("Изменить раздел")
                    }
                TextButton(onClick = { ordering = !ordering }, enabled = filter == "all") {
                    Text(if (ordering) "Готово" else "Порядок")
                }
            }
            TextButton(onClick = { context.edit("journal-refresh") }) { Text("Обновить") }
        }
        val events = section?.get("events").arrayValue().map { it.objectValue() }.asReversed()
        if (events.isEmpty())
            SheetEmpty(if (section == null) "Создайте первый раздел" else "Записей пока нет")
        events
            .filter { filter == "all" || it.text("type") == filter }
            .forEach { event ->
                JournalEntryView(event, canEdit, { info = event })
                if (canEdit && ordering && filter == "all")
                    Row {
                        val target =
                            "journal-order:${section?.get("id").referenceId()}:${event["id"].referenceId()}"
                        TextButton(
                            onClick = { context.edit("$target:up") },
                            enabled = events.firstOrNull() != event,
                        ) {
                            Text("Поднять")
                        }
                        TextButton(
                            onClick = { context.edit("$target:down") },
                            enabled = events.lastOrNull() != event,
                        ) {
                            Text("Опустить")
                        }
                    }
                HorizontalDivider(color = WebPalette.Border.copy(alpha = .5f))
            }
    }
    info?.let { event ->
        ShareFormDialog("О записи", { info = null }) {
            Text("Автор: ${event.text("authorName")}", style = ShareTypography.context)
            Text(
                "Создано: ${relativeCharacterDate(event.text("createdAt"))}",
                style = ShareTypography.context,
            )
            Text("Изменил: ${event.text("changedByName")}", style = ShareTypography.context)
            Text(
                "Изменено: ${relativeCharacterDate(event.text("changedAt"))}",
                style = ShareTypography.context,
            )
            event["sourceSnapshot"].objectValue().text("name").takeIf(String::isNotBlank)?.let {
                Text("Источник: $it", style = ShareTypography.context)
            }
        }
    }
}

@Composable
private fun JournalEntryView(event: JsonObject, canEdit: Boolean, info: () -> Unit) {
    val context = LocalCharacterSheet.current
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                event.text("title").ifBlank { journalTypes[event.text("type")] ?: "Запись" },
                style =
                    if (event.text("type") in setOf("header", "newday")) ShareTypography.section
                    else ShareTypography.group,
            )
            TextButton(onClick = info) { Text("Информация") }
            if (canEdit)
                TextButton(
                    onClick = { context.edit("journal-entry:${event["id"].referenceId()}") }
                ) {
                    Text("Изменить")
                }
        }
        if (event.text("type") !in setOf("header", "newday")) SheetDescription(event.text("desc"))
        val payload = event["payload"].objectValue()
        payload["dialogue"].arrayValue().forEach { raw ->
            val row = raw.objectValue()
            Text(row.text("speaker"), style = ShareTypography.group)
            SheetDescription(row.text("text"))
        }
        payload["combatants"].arrayValue().forEach { raw ->
            val row = raw.objectValue()
            val id = row["itemId"].referenceId()
            TextButton(onClick = { id?.let(context.openItem) }, enabled = id != null) {
                Text(
                    "${row.text("itemName").ifBlank {row.text("name")}} × ${row["count"].number(1)}"
                )
            }
            val details =
                listOfNotNull(
                    row["ac"]
                        ?.takeUnless { it == JsonNull }
                        ?.let { "КД ${it.jsonPrimitive.content}" },
                    row["hp"]
                        ?.takeUnless { it == JsonNull }
                        ?.let { "Хиты ${it.jsonPrimitive.content}" },
                )
            if (details.isNotEmpty())
                Text(details.joinToString(" · "), style = ShareTypography.context)
            SheetDescription(row.text("desc"))
        }
        if (event.text("type") == "quest") {
            val quest = payload["quest"].objectValue()
            quest["objectives"].arrayValue().forEach { raw ->
                val row = raw.objectValue()
                Row {
                    Checkbox(row["done"] == JsonPrimitive(true), null)
                    Text(row.text("text"), Modifier.weight(1f), style = ShareTypography.context)
                }
            }
            quest.text("reward").takeIf(String::isNotBlank)?.let {
                Text("Награда: $it", style = ShareTypography.group)
            }
        }
    }
}

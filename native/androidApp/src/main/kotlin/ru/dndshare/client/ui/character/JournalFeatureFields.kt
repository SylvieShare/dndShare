package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun JournalFeatureFields(form: FeatureFormScope, cache: CacheDao) {
    val kind = form.editor.fields.target.substringBefore(':')
    val data = form.data
    val isNew = data.text("identity") == "new"
    LaunchedEffect(data.text("type")) {
        if (data.text("type") == "quest" && data["payload"].objectValue()["quest"] == null)
            form.payload(
                "quest",
                buildJsonObject {
                    put("reward", "")
                    put("objectives", JsonArray(emptyList()))
                },
            )
    }
    if (kind == "journal-source") {
        Text(data.text("sourceName"), style = ShareTypography.group)
        return
    }
    form.TextField(
        "title",
        if (kind == "journal-section") "Название раздела" else "Название записи",
    )
    if (kind == "journal-section") form.TextField("date", "Дата")
    else {
        if (isNew) form.Choice("type", "Тип записи", journalTypes.toList())
        else Text(journalTypes[data.text("type")].orEmpty(), style = ShareTypography.group)
        if (data.text("type") !in setOf("header", "newday")) {
            form.TextField("desc", "Описание", multiline = true)
            val payload = data["payload"].objectValue()
            when (data.text("type")) {
                "dialog" -> JournalDialogueFields(form, payload)
                "battle" -> JournalBattleFields(form, payload, cache)
                "quest" -> JournalQuestFields(form, payload)
            }
        }
    }
    if (!isNew)
        form.Toggle(
            "remove",
            if (kind == "journal-section") "Удалить раздел со всеми записями" else "Удалить запись",
        )
}

private fun FeatureFormScope.payload(key: String, value: JsonElement) =
    input("payload", JsonObject(data["payload"].objectValue() + (key to value)))

@Composable
private fun JournalDialogueFields(form: FeatureFormScope, payload: JsonObject) {
    val rows = payload["dialogue"].arrayValue()
    rows.forEachIndexed { index, raw ->
        val row = raw.objectValue()
        key(row.text("id").ifBlank { index.toString() }) {
            fun change(field: String, value: String) =
                form.row(listOf("payload", "dialogue"), index, field, JsonPrimitive(value))
            ShareTextInput(
                row.text("speaker"),
                { change("speaker", it) },
                "Кто говорит",
                enabled = form.enabled,
            )
            ShareTextInput(
                row.text("text"),
                { change("text", it) },
                "Текст реплики",
                enabled = form.enabled,
                multiline = true,
            )
            ShareTextButton(
                onClick = {
                    form.rows(listOf("payload", "dialogue")) {
                        it.filterIndexed { i, _ -> i != index }
                    }
                },
                enabled = form.enabled,
            ) {
                Text("Убрать реплику", color = WebPalette.Danger)
            }
        }
    }
    ShareTextButton(
        onClick = {
            form.rows(listOf("payload", "dialogue")) {
                it +
                    buildJsonObject {
                        put("id", UUID.randomUUID().toString())
                        put("speaker", "")
                        put("text", "")
                    }
            }
        },
        enabled = form.enabled,
    ) {
        Text("Добавить реплику")
    }
}

@Composable
private fun JournalQuestFields(form: FeatureFormScope, payload: JsonObject) {
    val quest = payload["quest"].objectValue()
    val rows = quest["objectives"].arrayValue()
    fun update(key: String, value: JsonElement) = form.field(listOf("payload", "quest", key), value)
    rows.forEachIndexed { index, raw ->
        val row = raw.objectValue()
        key(row.text("id")) {
            fun change(key: String, value: JsonElement) =
                form.row(listOf("payload", "quest", "objectives"), index, key, value)
            Row {
                ShareCheckbox(
                    row["done"] == JsonPrimitive(true),
                    { change("done", JsonPrimitive(it)) },
                    enabled = form.enabled,
                )
                Text("Пункт ${index+1}")
            }
            ShareTextInput(
                row.text("text"),
                { change("text", JsonPrimitive(it)) },
                "Текст пункта",
                enabled = form.enabled,
                multiline = true,
            )
            ShareTextButton(
                onClick = {
                    form.rows(listOf("payload", "quest", "objectives")) {
                        it.filterIndexed { i, _ -> i != index }
                    }
                },
                enabled = form.enabled,
            ) {
                Text("Убрать пункт", color = WebPalette.Danger)
            }
        }
    }
    ShareTextButton(
        onClick = {
            form.rows(listOf("payload", "quest", "objectives")) {
                it +
                    buildJsonObject {
                        put("id", UUID.randomUUID().toString())
                        put("text", "")
                        put("done", false)
                    }
            }
        },
        enabled = form.enabled && rows.size < 100,
    ) {
        Text("Добавить пункт")
    }
    ShareTextInput(
        quest.text("reward"),
        { update("reward", JsonPrimitive(it)) },
        "Награда",
        enabled = form.enabled,
        multiline = true,
    )
}

@Composable
private fun JournalBattleFields(form: FeatureFormScope, payload: JsonObject, cache: CacheDao) {
    val rows = payload["combatants"].arrayValue()
    var picking by remember { mutableStateOf<Int?>(null) }
    fun change(index: Int, key: String, value: JsonElement) =
        form.row(listOf("payload", "combatants"), index, key, value)
    rows.forEachIndexed { index, raw ->
        val row = raw.objectValue()
        key(row.text("id").ifBlank { index.toString() }) {
            Text("Участник ${index+1}", style = ShareTypography.group)
            Row {
                ShareChoiceChip(
                    row.text("source") != "handbook",
                    { change(index, "source", JsonPrimitive("custom")) },
                    label = { Text("Своё существо") },
                    enabled = form.enabled,
                )
                ShareChoiceChip(
                    row.text("source") == "handbook",
                    { change(index, "source", JsonPrimitive("handbook")) },
                    label = { Text("Из бестиария") },
                    enabled = form.enabled,
                )
            }
            if (row.text("source") == "handbook")
                ShareTextButton(onClick = { picking = index }, enabled = form.enabled) {
                    Text(row.text("itemName").ifBlank { "Выбрать существо" })
                }
            else
                ShareTextInput(
                    row.text("name"),
                    { change(index, "name", JsonPrimitive(it)) },
                    "Имя участника",
                    enabled = form.enabled,
                )
            for ((field, title) in
                mapOf("count" to "Количество", "ac" to "Класс брони", "hp" to "Хиты")) if (
                field == "count" || row.text("source") != "handbook"
            )
                SheetNumberInput(title, row.text(field), form.enabled) {
                    change(index, field, if (it.isBlank()) JsonNull else JsonPrimitive(it))
                }
            ShareTextInput(
                row.text("desc"),
                { change(index, "desc", JsonPrimitive(it)) },
                "Заметка об участнике",
                enabled = form.enabled,
                multiline = true,
            )
            ShareTextButton(
                onClick = {
                    form.rows(listOf("payload", "combatants")) {
                        it.filterIndexed { i, _ -> i != index }
                    }
                },
                enabled = form.enabled,
            ) {
                Text("Убрать участника", color = WebPalette.Danger)
            }
        }
    }
    ShareTextButton(
        onClick = {
            form.rows(listOf("payload", "combatants")) {
                it +
                    buildJsonObject {
                        put("id", UUID.randomUUID().toString())
                        put("source", "custom")
                        put("name", "")
                        put("count", 1)
                    }
            }
        },
        enabled = form.enabled,
    ) {
        Text("Добавить участника")
    }
    picking?.let { index ->
        SheetItemPicker(cache, form.editor.baseline, listOf(6L), { picking = null }) { item ->
            val row = rows[index].objectValue()
            form.payload(
                "combatants",
                JsonArray(
                    rows.toMutableList().apply {
                        set(
                            index,
                            JsonObject(
                                row +
                                    mapOf(
                                        "source" to JsonPrimitive("handbook"),
                                        "itemId" to JsonPrimitive(item.id),
                                        "itemName" to JsonPrimitive(item.name),
                                    )
                            ),
                        )
                    }
                ),
            )
            picking = null
        }
    }
}

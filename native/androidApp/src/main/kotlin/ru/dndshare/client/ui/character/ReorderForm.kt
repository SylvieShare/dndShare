package ru.dndshare.client.ui.character

import androidx.compose.runtime.Composable
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.ShareReorderList

private fun reorderTarget(target: String) =
    target.substringAfter(':').split('|', limit = 2).let {
        it.first() to it.getOrElse(1) { "" }
    }

private fun reorderReferences(target: String, sheet: CharacterSheet): List<JsonElement> {
    val (kind, key) = reorderTarget(target)
    return when (kind) {
        "inventory" -> {
            val model = normalizeInventorySpaces(sheet.values["items"].objectValue())
            val section =
                model["sections"]
                    .arrayValue()
                    .map { it.objectValue() }
                    .singleOrNull { it.text("id") == key } ?: error("Хранилище больше недоступно.")
            val entries = inventorySpaceEntries(model, key)
            val slots = resolveInventorySlots(entries, section["slots"].objectValue())
            entries.sortedBy { slots[it.text("uid")] }
        }
        "weapons" -> sheet.values["weapon"].arrayValue()
        "spells" ->
            sheet.values["spells"]
                .objectValue()["tabs"]
                .arrayValue()
                .map { it.objectValue() }
                .singleOrNull { it.text("key") == key }
                ?.get("spells")
                .arrayValue()
        "spell-tabs" -> sheet.values["spells"].objectValue()["tabs"].arrayValue()
        else -> error("Список не поддерживает изменение порядка.")
    }
}

private fun reorderKey(kind: String, entry: JsonObject) =
    when (kind) {
        "spells",
        "spell-tabs" -> entry.text("key")
        else -> entry.text("uid")
    }

internal fun initialReorderInput(
    target: String,
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
): JsonObject {
    val (kind, key) = reorderTarget(target)
    val rows =
        if (kind == "actions")
            featureActions(sheet, items).filter { it.type == key }.map { it.key to it.title }
        else
            reorderReferences(target, sheet).map { raw ->
                val row = raw.objectValue()
                val item =
                    items[(row["magic_item_id"] ?: row["item_id"] ?: row["id"]).referenceId()]
                reorderKey(kind, row) to
                    row["override"]
                        .objectValue()
                        .text("name")
                        .ifBlank { row.text("name") }
                        .ifBlank { item?.name.orEmpty() }
                        .ifBlank { "Запись" }
            }
    require(
        rows.all { it.first.isNotBlank() } && rows.map { it.first }.distinct().size == rows.size
    ) {
        "В списке нет уникальных идентификаторов."
    }
    return buildJsonObject {
        put(
            "entries",
            JsonArray(
                rows.map { (id, title) ->
                    buildJsonObject {
                        put("key", id)
                        put("title", title)
                    }
                }
            ),
        )
    }
}

internal fun reorderFormPatches(
    form: SheetFormFields,
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
): List<SheetPatch> {
    val (kind, key) = reorderTarget(form.target)
    val expected =
        initialReorderInput(form.target, sheet, items)["entries"].arrayValue().map {
            it.objectValue().text("key")
        }
    val order = form.input["entries"].arrayValue().map { it.objectValue().text("key") }
    require(order.size == order.distinct().size && order.toSet() == expected.toSet()) {
        "Состав списка изменился. Откройте сортировку заново."
    }
    fun patch(path: List<JsonElement>, value: JsonElement) =
        listOf(SheetPatch(path = path, value = value))
    if (kind == "actions") {
        val old = sheet.values["action_order"].arrayValue().map { it.jsonPrimitive.content }
        return patch(
            sheetPath("values", "action_order"),
            JsonArray((old.filterNot { it in expected } + order).map(::JsonPrimitive)),
        )
    }
    val byKey =
        reorderReferences(form.target, sheet).associateBy { reorderKey(kind, it.objectValue()) }
    val sorted = JsonArray(order.map { byKey.getValue(it) })
    return when (kind) {
        "weapons" -> patch(sheetPath("values", "weapon"), sorted)
        "inventory" -> {
            val model = normalizeInventorySpaces(sheet.values["items"].objectValue())
            val next = run {
                val sections =
                    model["sections"].arrayValue().map { raw ->
                        val row = raw.objectValue()
                        if (row.text("id") != key) row
                        else {
                            val entries = inventorySpaceEntries(model, key)
                            val physicalSlots =
                                resolveInventorySlots(entries, row["slots"].objectValue())
                                    .values
                                    .sorted()
                            val positions =
                                JsonObject(
                                    order
                                        .mapIndexed { index, uid ->
                                            uid to JsonPrimitive(physicalSlots[index])
                                        }
                                        .toMap()
                                )
                            val stored =
                                row["items"].arrayValue().associateBy {
                                    it.objectValue().text("uid")
                                }
                            JsonObject(
                                row +
                                    mapOf(
                                        "items" to JsonArray(order.mapNotNull(stored::get)),
                                        "slots" to positions,
                                    )
                            )
                        }
                    }
                JsonObject(model + ("sections" to JsonArray(sections)))
            }
            patch(sheetPath("values", "items"), next)
        }
        "spells",
        "spell-tabs" -> {
            val book = sheet.values["spells"].objectValue()
            val tabs =
                if (kind == "spell-tabs") sorted
                else
                    JsonArray(
                        book["tabs"].arrayValue().map { raw ->
                            val row = raw.objectValue()
                            if (row.text("key") != key) row
                            else JsonObject(row + ("spells" to sorted))
                        }
                    )
            patch(sheetPath("values", "spells"), JsonObject(book + ("tabs" to tabs)))
        }
        else -> error("Список недоступен.")
    }
}

@Composable
internal fun ReorderFields(form: FeatureFormScope) {
    ShareReorderList(
        form.data["entries"].arrayValue().map {
            it.objectValue().let { row -> row.text("key") to row.text("title") }
        },
        form.enabled,
    ) { from, to ->
        form.rows(listOf("entries")) { rows ->
            val moved = rows.toMutableList()
            val start = moved.indexOfFirst { it.objectValue().text("key") == from }
            val end = moved.indexOfFirst { it.objectValue().text("key") == to }
            if (start >= 0 && end >= 0 && start != end) moved.add(end, moved.removeAt(start))
            moved
        }
    }
}

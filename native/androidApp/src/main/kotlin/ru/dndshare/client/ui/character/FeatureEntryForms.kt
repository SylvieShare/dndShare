package ru.dndshare.client.ui.character

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

internal fun featureEntryInput(target: String, values: JsonObject): JsonObject {
    val parts = target.split(':')
    val bucket =
        when (parts[0]) {
            "resource" -> "resources"
            "defense" -> "defenses"
            "action" -> "actions"
            else -> parts.getOrElse(1) { "abilities_feats" }
        }
    val index = parts.getOrNull(if (parts[0] == "ability") 2 else 1)?.toIntOrNull()
    val row = values[bucket].arrayValue().getOrNull(index ?: -1).objectValue()
    val input = row.toMutableMap()
    // Ability ids are existing source identities. Giving an id-only entry a new
    // uid while editing would detach its active states and resource references.
    if (!bucket.startsWith("abilities_") && row["uid"] == null)
        input["uid"] = JsonPrimitive(UUID.randomUUID().toString())
    input["bucket"] = JsonPrimitive(bucket)
    input["index"] = JsonPrimitive(index ?: -1)
    if (parts[0] == "action" && input["action_type"] == null)
        input["action_type"] = JsonPrimitive("action")
    return JsonObject(input)
}

internal fun featureEntryPatches(
    form: SheetFormFields,
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata = HandbookMetadata(),
): List<SheetPatch> {
    val kind = form.target.substringBefore(':')
    val input = form.input
    val bucket = input.text("bucket")
    require(
        bucket in
            setOf(
                "resources",
                "defenses",
                "actions",
                "abilities_feats",
                "abilities_race",
                "abilities_class",
                "abilities_story",
            )
    )
    val rows = sheet.values[bucket].arrayValue().toMutableList()
    val index = input["index"].number(-1)
    val before = rows.getOrNull(index).objectValue()
    if (input["remove"] == JsonPrimitive(true)) {
        require(index in rows.indices)
        rows.removeAt(index)
    } else {
        val row =
            (rows.getOrNull(index).objectValue() +
                    (input - setOf("bucket", "index", "remove", "selected_name")))
                .toMutableMap()
        when (kind) {
            "resource" -> {
                require(input.text("title").isNotBlank()) { "Введите название ресурса." }
                val total = inputInteger(input, "total", max = 10000)
                row["total"] = JsonPrimitive(total)
                row["value"] = JsonPrimitive(inputInteger(input, "value", max = total))
            }
            "defense" -> {
                require(input.text("kind") in setOf("resistance", "immunity", "vulnerability"))
                row["damage_type"] = JsonPrimitive(inputInteger(input, "damage_type", min = 1))
            }
            "action" -> {
                require(input.text("title").isNotBlank()) { "Введите название действия." }
                require(input.text("action_type") in featureActionTypes) {
                    "Выберите тип действия."
                }
                row["requirements"] =
                    JsonArray(
                        input["requirements"]
                            .arrayValue()
                            .map { it.jsonPrimitive.content.trim() }
                            .filter(String::isNotEmpty)
                            .map(::JsonPrimitive)
                    )
                if (input.text("action_type") == "timed") {
                    val time = input["time"].objectValue()
                    val unit = time.text("kind").ifBlank { "minutes" }
                    require(unit in setOf("rounds", "minutes", "hours", "days")) {
                        "Выберите единицу времени."
                    }
                    row["time"] = buildJsonObject {
                        put("kind", unit)
                        put(
                            "value",
                            inputInteger(time, "value", default = 1, min = 1, max = 1_000_000),
                        )
                    }
                } else row.remove("time")
            }
            "ability" -> {
                val id = input["id"].referenceId() ?: error("Выберите способность.")
                val item = items[id] ?: error("Способность недоступна в справочнике.")
                require(
                    item.data["repeatable"] == JsonPrimitive(true) ||
                        rows.filterIndexed { i, _ -> i != index }.none { it.referenceId() == id }
                ) {
                    "Эта способность уже добавлена."
                }
                require(index >= 0 || item.data["selection_parent_id"].referenceId() == null) {
                    "Выберите эту способность через её родительский набор."
                }
                row["id"] = JsonPrimitive(id)
                if (input["count"] != null && input["count"] != JsonNull)
                    row["count"] = JsonPrimitive(inputInteger(input, "count"))
                prepareAbilityEntry(
                    row,
                    if (before.referenceId() == id) before else JsonObject(emptyMap()),
                    sheet,
                    item,
                    metadata,
                    items,
                )
            }
        }
        if (index in rows.indices) rows[index] = JsonObject(row) else rows.add(JsonObject(row))
    }
    val patches = listOf(SheetPatch(path = sheetPath("values", bucket), value = JsonArray(rows)))
    if (kind != "ability") return patches
    val projected = sheet.copy(data = applySheetPatches(sheet.data, patches))
    val after =
        if (input["remove"] == JsonPrimitive(true)) null
        else rows.getOrNull(if (index in rows.indices) index else rows.lastIndex).objectValue()
    return patches + abilityEntrySideEffects(projected, bucket, before, after, items)
}

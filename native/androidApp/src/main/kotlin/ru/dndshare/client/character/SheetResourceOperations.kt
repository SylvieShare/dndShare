package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

data class ResourceOwner(
    val itemId: Long,
    val valueId: String,
    val entryKey: String,
    val resourceKey: String = "",
)

/** A resource points to its canonical owner; inventory quantity is never a charge counter. */
data class ResourceControl(
    val key: String,
    val title: String,
    val value: Int,
    val total: Int,
    val rule: JsonObject,
    val path: List<JsonElement>,
    val ownerLevel: Int,
    val owner: ResourceOwner? = null,
)

fun sheetSelector(field: String, id: JsonElement): JsonObject = buildJsonObject {
    put("idField", field)
    put("id", id)
}

fun resourceControls(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    includeInactive: Boolean = false,
): List<ResourceControl> = buildList {
    for ((index, raw) in sheet.values["resources"].arrayValue().withIndex()) {
        val row = raw.objectValue()
        val total = row["total"].number().coerceAtLeast(0)
        // Manual resources historically have no stable ids, so this control replaces their bucket.
        add(
            ResourceControl(
                "manual:resources:$index",
                row.text("title"),
                row["value"].number().coerceIn(0, total),
                total,
                row,
                emptyList(),
                sheet.values["lvl"].objectValue()["level"].number(1),
            )
        )
    }
    for (feature in ownedFeatures(sheet, items)) {
        if (
            feature.item.typeId == 19L &&
                (feature.instance["params"].objectValue()["magic"].objectValue()["lost"] ==
                    JsonPrimitive(true) ||
                    feature.instance["params"].objectValue()["creation"].objectValue()["expired"] ==
                        JsonPrimitive(true))
        )
            continue
        val ownerPath =
            if (feature.key == "magic_items")
                inventoryInstancePath(sheet, feature.instance.text("uid")) +
                    sheetPath("params", "magic")
            else
                sheetPath("values", feature.key) +
                    sheetSelector(
                        if (feature.entry["uid"] != null) "uid" else "id",
                        feature.entry["uid"] ?: feature.entry.getValue("id"),
                    )
        val definitions = feature.item.data["use_resources"].arrayValue()
        val rules =
            if (definitions.isEmpty()) listOf(feature.item.data)
            else definitions.map { it.objectValue() }
        for ((index, rule) in rules.withIndex()) {
            if (
                !includeInactive &&
                    feature.item.typeId == 19L &&
                    !magicActive(
                        feature.item,
                        feature.instance,
                        feature.equipped,
                        sheet,
                        rule.text("activation"),
                    )
            )
                continue
            val total =
                resourceMaximum(rule, feature.item, feature.entry, sheet)?.coerceAtLeast(0)
                    ?: continue
            if (total <= 0) continue
            val key = rule.text("key").ifBlank { "resource_${index + 1}" }
            val field = if (feature.key == "magic_items") "remaining" else "count"
            val path =
                ownerPath +
                    if (definitions.isEmpty()) sheetPath(field)
                    else sheetPath("resource_counts", key)
            val current =
                if (definitions.isEmpty()) feature.entry["count"].number(total)
                else feature.entry["resource_counts"].objectValue()[key].number(total)
            add(
                ResourceControl(
                    "abilities:${feature.key}:${feature.entry.text("uid").ifBlank { feature.entry.text("id") }}${if (definitions.isEmpty()) "" else ":$key"}",
                    rule.text("title").ifBlank { feature.item.name },
                    current.coerceIn(0, total),
                    total,
                    rule,
                    path,
                    ownerLevel(feature.item.data, sheet),
                    ResourceOwner(
                        feature.item.id,
                        feature.key,
                        featureEntryKey(feature),
                        if (definitions.isEmpty()) "" else key,
                    ),
                )
            )
        }
    }
    val pools = linkedMapOf<String, ResourceControl>()
    for (raw in sheet.values["classes"].arrayValue()) {
        val entry = raw.objectValue()
        val item = items[entry["id"].referenceId()] ?: continue
        val level = entry["level"].number()
        for (value in item.data["class_resources"].arrayValue()) {
            val rule = value.objectValue()
            val key = rule.text("key")
            if (key.isBlank() || level < rule["level"].number(1)) continue
            val scale =
                rule["scaling"]
                    .arrayValue()
                    .map { it.objectValue() }
                    .filter { it["level"].number() <= level && it["uses"] != null }
                    .maxByOrNull { it["level"].number() }
            val total = (scale?.get("uses") ?: rule["max_use"])?.number() ?: continue
            val old = pools[key]
            val merged =
                JsonObject(
                    rule +
                        mapOf(
                            "rollback_short_rest" to
                                JsonPrimitive(
                                    rule["rollback_short_rest"] == JsonPrimitive(true) ||
                                        old?.rule?.get("rollback_short_rest") == JsonPrimitive(true)
                                ),
                            "rollback_long_rest" to
                                JsonPrimitive(
                                    rule["rollback_long_rest"] == JsonPrimitive(true) ||
                                        old?.rule?.get("rollback_long_rest") == JsonPrimitive(true)
                                ),
                        )
                )
            val maximum = maxOf(total, old?.total ?: 0)
            pools[key] =
                ResourceControl(
                    "classes:$key",
                    rule.text("title").ifBlank { item.name },
                    sheet.values["class_resource_counts"]
                        .objectValue()[key]
                        .number(maximum)
                        .coerceIn(0, maximum),
                    maximum,
                    merged,
                    sheetPath("values", "class_resource_counts", key),
                    level,
                )
        }
    }
    addAll(pools.values)
}

fun inventoryInstancePath(sheet: CharacterSheet, uid: String): List<JsonElement> {
    val selector = sheetSelector("uid", JsonPrimitive(uid))
    if (sheet.values["weapon"].arrayValue().any { it.objectValue().text("uid") == uid })
        return sheetPath("values", "weapon") + selector
    val model = sheet.values["items"].objectValue()
    if (model["equipped"].arrayValue().any { it.objectValue().text("uid") == uid })
        return sheetPath("values", "items", "equipped") + selector
    val section =
        model["sections"]
            .arrayValue()
            .map { it.objectValue() }
            .firstOrNull { row ->
                row["items"].arrayValue().any { it.objectValue().text("uid") == uid }
            } ?: error("Предмет больше не существует.")
    return sheetPath("values", "items", "sections") +
        sheetSelector("id", section.getValue("id")) +
        sheetPath("items") +
        selector
}

/** Creates missing object parents explicitly; document patches never infer container types. */
fun resourceValuePatch(sheet: CharacterSheet, resource: ResourceControl, amount: Int): SheetPatch {
    val value = amount.coerceIn(0, resource.total)
    if (resource.key.startsWith("manual:")) {
        val index = resource.key.substringAfterLast(':').toInt()
        val rows = sheet.values["resources"].arrayValue().toMutableList()
        rows[index] = JsonObject(rows[index].objectValue() + ("value" to JsonPrimitive(value)))
        return SheetPatch(path = sheetPath("values", "resources"), value = JsonArray(rows))
    }
    resource.owner?.let { owner ->
        val multiple = owner.resourceKey.isNotBlank()
        val path = resource.path.dropLast(if (multiple) 2 else 1)
        val previous = sheetValue(sheet.data, path).objectValue()
        val fields =
            if (multiple)
                mapOf(
                    "resource_counts" to
                        JsonObject(
                            previous["resource_counts"].objectValue() +
                                (owner.resourceKey to JsonPrimitive(value))
                        )
                )
            else
                mapOf(
                    (if (owner.valueId == "magic_items") "remaining" else "count") to
                        JsonPrimitive(value)
                )
        return sheetFieldPatch(
            sheet,
            path,
            JsonObject(previous + fields + ("resource_version" to JsonPrimitive(1))),
        )
    }
    for (size in 1 until resource.path.size) {
        val path = resource.path.take(size)
        if (sheetValue(sheet.data, path) == null) {
            var nested: JsonElement = JsonPrimitive(value)
            for (part in resource.path.drop(size).asReversed()) nested =
                JsonObject(mapOf(part.jsonPrimitive.content to nested))
            return SheetPatch(path = path, value = nested)
        }
    }
    return SheetPatch(path = resource.path, value = JsonPrimitive(value))
}

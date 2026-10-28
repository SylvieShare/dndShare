package ru.dndshare.client.character

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

fun statusEffectId(link: JsonObject): Long? =
    (link["effect_id"] ?: link["effectId"] ?: link["effect"] ?: link["id"]).referenceId()

fun statusEffectLinks(item: CatalogueItem): List<JsonObject> =
    item.data["status_effects"].arrayValue().mapNotNull { raw ->
        val row = raw.objectValue()
        val id = statusEffectId(row) ?: return@mapNotNull null
        JsonObject(
            row +
                mapOf(
                    "effect_id" to JsonPrimitive(id),
                    "key" to JsonPrimitive(row.text("key").ifBlank { id.toString() }),
                )
        )
    }

fun featureEntryKey(feature: OwnedFeature) =
    feature.entry.text("uid").ifBlank { feature.entry.text("id") }

fun featureEntryPath(sheet: CharacterSheet, feature: OwnedFeature): List<JsonElement> =
    if (feature.key == "magic_items")
        inventoryInstancePath(sheet, featureEntryKey(feature)) + sheetPath("params", "magic")
    else
        sheetPath("values", feature.key) +
            sheetSelector(
                if (feature.entry["uid"] != null) "uid" else "id",
                feature.entry["uid"] ?: feature.entry.getValue("id"),
            )

fun linkedStatusSource(feature: OwnedFeature, link: JsonObject) = buildJsonObject {
    put("kind", "ability")
    put("item_id", feature.item.id)
    put("value_id", feature.key)
    put("entry_key", featureEntryKey(feature))
    put("link_key", link.text("key"))
    put("label", feature.item.name)
}

fun linkedStatusActive(sheet: CharacterSheet, feature: OwnedFeature, link: JsonObject): Boolean {
    if (link.text("target") == "other") return false
    val wanted = linkedStatusSource(feature, link)
    return sheet.values["states"].arrayValue().any { raw ->
        val row = raw.objectValue()
        row["effect_id"].referenceId() == statusEffectId(link) &&
            listOf("kind", "item_id", "value_id", "entry_key", "link_key").all { key ->
                row["source"].objectValue().text(key) == wanted.text(key)
            }
    }
}

fun createStatusInstance(
    effect: CatalogueItem,
    source: JsonObject,
    params: JsonObject = JsonObject(emptyMap()),
    duration: JsonElement? = null,
    concentration: Boolean? = null,
): JsonObject = buildJsonObject {
    put("uid", UUID.randomUUID().toString())
    put("effect_id", effect.id)
    put("source", source)
    put(
        "params",
        JsonObject(
            buildMap {
                if (effect.data["level"].number() > 0)
                    put("level", JsonPrimitive(effect.data["level"].number()))
                putAll(params)
            }
        ),
    )
    put(
        "duration",
        JsonObject(
            mapOf("kind" to JsonPrimitive("manual")) +
                (duration ?: effect.data["duration"]).objectValue()
        ),
    )
    put("concentration", concentration ?: (effect.data["concentration"] == JsonPrimitive(true)))
}

fun addStatusInstance(
    previous: List<JsonElement>,
    effect: CatalogueItem,
    created: JsonObject,
): List<JsonElement> {
    var result = previous
    if (
        created["concentration"] == JsonPrimitive(true) ||
            effect.data["derived_effects"].arrayValue().any {
                val rule = it.objectValue()
                rule.text("kind") == "activity_block" &&
                    JsonPrimitive("concentration") in rule["scopes"].arrayValue()
            }
    )
        result = result.filterNot { it.objectValue()["concentration"] == JsonPrimitive(true) }
    if (
        effect.data.text("stacking") != "multiple" &&
            result.any { it.objectValue()["effect_id"].referenceId() == effect.id }
    )
        return result
    return result + created
}

fun withStatusEndEffects(
    previous: List<JsonElement>,
    next: List<JsonElement>,
    items: Map<Long, CatalogueItem>,
): List<JsonElement> {
    var result = next
    for (raw in previous) {
        val row = raw.objectValue()
        if (next.any { it.objectValue().text("uid") == row.text("uid") }) continue
        val source = items[row["effect_id"].referenceId()] ?: continue
        val effect = items[source.data["on_end_effect"].referenceId()] ?: continue
        result =
            addStatusInstance(
                result,
                effect,
                createStatusInstance(
                    effect,
                    buildJsonObject {
                        put("kind", "effect")
                        put("item_id", source.id)
                        put("label", source.name)
                    },
                ),
            )
    }
    return result
}

fun toggleLinkedStatus(
    sheet: CharacterSheet,
    feature: OwnedFeature,
    link: JsonObject,
    items: Map<Long, CatalogueItem>,
    removeAll: Boolean = false,
): SheetPatch {
    require(link.text("target") != "other") { "Эффект применяется к другому персонажу." }
    val effect = items[statusEffectId(link)] ?: error("Дождитесь загрузки эффекта из справочника.")
    val before = sheet.values["states"].arrayValue()
    val source = linkedStatusSource(feature, link)
    val existing = before.filter { raw ->
        val row = raw.objectValue()
        row["effect_id"].referenceId() == effect.id &&
            (removeAll ||
                listOf("kind", "item_id", "value_id", "entry_key", "link_key").all {
                    row["source"].objectValue().text(it) == source.text(it)
                })
    }
    val next =
        if (existing.isNotEmpty()) before - existing.toSet()
        else {
            val params = link["params"].objectValue().toMutableMap()
            for (raw in link["parameter_bindings"].arrayValue()) {
                val binding = raw.objectValue()
                val key = binding.text("key")
                if (key.isBlank()) continue
                if (binding.text("source") == "scaling_value") {
                    val scale =
                        feature.item.data["scaling"]
                            .arrayValue()
                            .map { it.objectValue() }
                            .filter { it["level"].number() <= ownerLevel(feature.item.data, sheet) }
                            .maxByOrNull { it["level"].number() }
                    val value =
                        Regex("[+\\-]?[0-9]+(?:\\.[0-9]+)?")
                            .find(scale?.text("value").orEmpty().replace(',', '.'))
                            ?.value
                            ?.toDoubleOrNull() ?: 0.0
                    params[key] =
                        if (value == value.toLong().toDouble()) JsonPrimitive(value.toLong())
                        else JsonPrimitive(value)
                } else binding["value"]?.let { params[key] = it }
            }
            addStatusInstance(
                before,
                effect,
                createStatusInstance(
                    effect,
                    source,
                    JsonObject(params),
                    link["duration"],
                    (link["concentration"] as? JsonPrimitive)?.booleanOrNull,
                ),
            )
        }
    return SheetPatch(
        path = sheetPath("values", "states"),
        value = JsonArray(withStatusEndEffects(before, next, items)),
    )
}

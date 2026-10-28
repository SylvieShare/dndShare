package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.creation.itemChoices
import ru.dndshare.client.model.*

/** Rebuild only grants whose complete ability owners are cached. Other grants remain untouched. */
fun syncAbilitySpellGrants(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    grants: List<JsonElement>,
): JsonArray {
    val features = ownedFeatures(sheet, items)
    val ids = featureOwnerIds(sheet)
    // Incomplete local catalogue data must never delete an owner's spells.
    if (ids.any { it !in items }) return JsonArray(grants)
    val retained =
        grants
            .filter { raw ->
                val source = raw.objectValue()["source"].objectValue()
                source.text("kind") !in setOf("ability", "magic_item")
            }
            .toMutableList()
    val entries =
        listOf("abilities_race", "abilities_class", "abilities_story", "abilities_feats")
            .flatMap { sheet.values[it].arrayValue() }
            .map { it.objectValue() }
    val desired = mutableListOf<JsonElement>()
    val seenItemOwners = mutableSetOf<Long>()
    for (feature in features) {
        val item = feature.item
        if (item.typeId != 19L && !seenItemOwners.add(item.id)) continue
        if (item.typeId == 19L && !magicActive(item, feature.instance, feature.equipped, sheet))
            continue
        val entry = feature.entry
        if (entry["requirements_met"] == JsonPrimitive(false)) continue
        val level = ownerLevel(item.data, sheet)
        val choices = itemChoices(item)
        fun choiceAbility(key: String): Int? {
            val selected =
                entry["choices"]
                    .objectValue()[key]
                    .arrayValue()
                    .firstOrNull()
                    ?.jsonPrimitive
                    ?.content ?: return null
            return choices
                .firstOrNull { it.text("key") == key }
                ?.get("options")
                .arrayValue()
                .map { it.objectValue() }
                .firstOrNull { it.text("value").ifBlank { it.text("label") } == selected }
                ?.get("casting_ability")
                ?.number()
        }
        val rules =
            item.data["granted_spells"].arrayValue().map { it.objectValue() }.toMutableList()
        for (choice in choices.filter { it["grant_spells"] == JsonPrimitive(true) }) {
            for (id in entry["choices"].objectValue()[choice.text("key")].arrayValue()) rules.add(
                JsonObject(
                    choice +
                        mapOf(
                            "spell" to id,
                            "ability" to
                                (choice["casting_ability"]
                                    ?: choiceAbility(choice.text("casting_ability_choice_key"))
                                        ?.let(::JsonPrimitive)
                                    ?: JsonNull),
                        )
                )
            )
        }
        for (rule in rules) {
            val id = rule["spell"].referenceId() ?: continue
            if (level < rule["level"].number(item.data["level"].number(1))) continue
            val owner = rule["ability_choice_source"].referenceId() ?: item.id
            val selected =
                if (owner == item.id) entry
                else entries.firstOrNull { it.referenceId() == owner }.objectValue()
            val ability =
                rule["ability"].referenceId()?.toInt()
                    ?: selected["choices"]
                        .objectValue()[rule.text("ability_choice_key")]
                        .arrayValue()
                        .firstOrNull()
                        ?.referenceId()
                        ?.toInt()
            val magic = item.typeId == 19L
            val kind = if (magic) "magic_item" else "ability"
            val uid = if (magic) feature.instance.text("uid") else ""
            val key = "$kind:${item.id}${if(uid.isNotBlank())":$uid" else ""}:spell:$id"
            val source = buildJsonObject {
                put("kind", kind)
                put("item_id", item.id)
                put("label", item.name)
                if (uid.isNotBlank()) put("entry_key", uid)
                ability?.takeIf { it in 1..6 }?.let { put("casting_ability", it) }
                rule["cast_level"]?.takeUnless { it == JsonNull }?.let { put("cast_level", it) }
            }
            desired.add(
                buildJsonObject {
                    put("key", key)
                    put("id", id)
                    put("source", source)
                    ability?.takeIf { it in 1..6 }?.let { put("casting_ability", it) }
                    rule["cast_level"]?.takeUnless { it == JsonNull }?.let { put("cast_level", it) }
                    if (rule["slotless"] == JsonPrimitive(true)) put("slotless", true)
                    if (rule["counts_as_known"] == JsonPrimitive(true)) put("counts_as_known", true)
                }
            )
        }
    }
    return JsonArray(
        retained +
            desired
                .distinctBy { it.objectValue().text("key") }
                .sortedBy { it.objectValue().text("key") }
    )
}

fun featureOwnerIds(sheet: CharacterSheet): Set<Long> = buildSet {
    for (key in listOf("abilities_race", "abilities_class", "abilities_story", "abilities_feats")) {
        sheet.values[key].arrayValue().mapNotNullTo(this) { it.referenceId() }
    }
    inventoryInstances(sheet).mapNotNullTo(this) {
        (it.first["magic_item_id"] ?: it.first["item_id"]).referenceId()
    }
}

fun abilitySpellGrantPatches(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
): List<SheetPatch> {
    if (sheet.templateName != "DND5") return emptyList()
    val book = sheet.values["spells"].objectValue()
    val grants = book["grants"].arrayValue()
    val next = syncAbilitySpellGrants(sheet, items, grants)
    if (next == JsonArray(grants)) return emptyList()
    val source =
        if (book.isNotEmpty()) book
        else
            buildJsonObject {
                put("schema_version", 2)
                put("tabs", JsonArray(emptyList()))
                put(
                    "slot_pools",
                    buildJsonObject {
                        put("long_rest", JsonArray(emptyList()))
                        put("short_rest", JsonArray(emptyList()))
                    },
                )
            }
    return listOf(
        SheetPatch(
            path = sheetPath("values", "spells"),
            value = JsonObject(source + ("grants" to next)),
        )
    )
}

package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*

internal fun appendAdvancementBonus(
    values: MutableMap<String, JsonElement>,
    stat: String,
    delta: Int,
    title: String,
    featKey: String? = null,
) {
    val row = values[stat].objectValue()
    val value = row["value"]
    val score =
        if (value is JsonObject) value
        else
            buildJsonObject {
                put("base", value.number(10))
                put("bonuses", JsonArray(emptyList()))
            }
    val bonus = buildJsonObject {
        put("title", title)
        put("value", delta)
        if (featKey != null) {
            put("name", title)
            put("readonly", true)
            put("sourceFeatKey", featKey)
        }
    }
    values[stat] =
        JsonObject(
            row +
                ("value" to
                    JsonObject(
                        score + ("bonuses" to JsonArray(score["bonuses"].arrayValue() + bonus))
                    ))
        )
}

internal fun applyAdvancementFeat(
    values: MutableMap<String, JsonElement>,
    feat: CatalogueItem,
    choices: JsonObject,
    metadata: HandbookMetadata,
    sheet: CharacterSheet,
    sourceKey: String = "feat:${feat.id}",
) {
    val bonuses = feat.data["asi"].arrayValue().map { it.objectValue() }.toMutableList()
    val asi = feat.data["asi_choice"].objectValue()
    if (asi.isNotEmpty())
        for (id in choices[asi.text("choice_key").ifBlank { "ability" }].arrayValue()) bonuses.add(
            buildJsonObject {
                put("ability", id)
                put("bonus", asi["bonus"].number())
            }
        )
    for (choice in itemChoices(feat)) if (choice["ability_bonus"].number() != 0)
        for (id in choices[choice.text("key")].arrayValue()) bonuses.add(
            buildJsonObject {
                put("ability", id)
                put("bonus", choice["ability_bonus"].number())
            }
        )
    for (bonus in bonuses) {
        val stat = creationStats.getOrNull(bonus["ability"].number() - 1) ?: continue
        val current =
            sheet
                .copy(data = JsonObject(sheet.data + ("values" to JsonObject(values))))
                .statScore(stat)
        val delta = bonus["bonus"].number().coerceIn(0, (20 - current).coerceAtLeast(0))
        if (delta > 0) appendAdvancementBonus(values, stat, delta, feat.name, sourceKey)
    }
    val grants = featGrants(feat, choices)
    // Proficiency labels come from the same suggestions captured in the form, not guessed ids.
    val types =
        mapOf("armor_prof" to "3", "weapon_prof" to "4", "tool_prof" to "5", "languages" to "6")
    val prof = values["proficiencies"].objectValue().toMutableMap()
    for ((field, bucket) in
        mapOf(
            "armor_prof" to "Доспехи",
            "weapon_prof" to "Оружие",
            "tool_prof" to "Инструменты",
            "languages" to "Языки",
        )) {
        val ids = grants[field].arrayValue().mapNotNull { it.referenceId() }
        val added =
            metadata.suggests[types[field]]
                .orEmpty()
                .filter { it.id in ids }
                .map { JsonPrimitive(it.value) }
        if (added.isNotEmpty())
            prof[bucket] = JsonArray((prof[bucket].arrayValue() + added).distinct())
    }
    if (prof.isNotEmpty()) values["proficiencies"] = JsonObject(prof)
    for (id in grants["skill_prof"].arrayValue().mapNotNull { it.referenceId() }) {
        val stat = skillStat(id) ?: continue
        val block = values[stat].objectValue()
        val skills = block["skills"].objectValue()
        val row = skills[id.toString()].objectValue()
        values[stat] =
            JsonObject(
                block +
                    ("skills" to
                        JsonObject(
                            skills +
                                (id.toString() to
                                    JsonObject(
                                        row + ("up" to JsonPrimitive(maxOf(1, row["up"].number())))
                                    ))
                        ))
            )
    }
    for (id in grants["save_prof"].arrayValue()) creationStats.getOrNull(id.number() - 1)?.let {
        stat ->
        values[stat] = JsonObject(values[stat].objectValue() + ("save_up" to JsonPrimitive(true)))
    }
}

internal fun applyAdvancementSpellbook(
    plan: LevelAdvancement,
    values: MutableMap<String, JsonElement>,
    added: List<CatalogueItem>,
) {
    val old = values["spells"].objectValue()
    val result = old.toMutableMap()
    val original = spellSlotPools(plan.oldClasses, plan.items)
    val expected = spellSlotPools(plan.classesAfter(), plan.items)
    val pools = old["slot_pools"].objectValue().toMutableMap()
    for (pool in listOf("long_rest", "short_rest")) {
        val actual = pools[pool].arrayValue().map { it.objectValue() }.toMutableList()
        val oldRows = original[pool].arrayValue().map { it.objectValue() }
        val newRows = expected[pool].arrayValue().map { it.objectValue() }
        var spentToMove = 0
        for (row in oldRows) {
            val level = row["level"].number()
            val next = newRows.firstOrNull { it["level"].number() == level }?.get("total").number()
            val removed = (row["total"].number() - next).coerceAtLeast(0)
            val at = actual.indexOfFirst { it["level"].number() == level }
            if (at >= 0 && removed > 0) {
                val amount = minOf(removed, actual[at]["total"].number())
                val used = minOf(amount, actual[at]["used"].number())
                spentToMove += used
                actual[at] =
                    JsonObject(
                        actual[at] +
                            mapOf(
                                "total" to JsonPrimitive(actual[at]["total"].number() - amount),
                                "used" to JsonPrimitive(actual[at]["used"].number() - used),
                            )
                    )
            }
        }
        for (row in newRows) {
            val level = row["level"].number()
            val before =
                oldRows.firstOrNull { it["level"].number() == level }?.get("total").number()
            val amount = (row["total"].number() - before).coerceAtLeast(0)
            if (amount > 0) {
                val at = actual.indexOfFirst { it["level"].number() == level }
                val current =
                    actual.getOrNull(at)
                        ?: buildJsonObject {
                            put("level", level)
                            put("total", 0)
                            put("used", 0)
                        }
                val moved = minOf(spentToMove, amount)
                spentToMove -= moved
                val next =
                    JsonObject(
                        current +
                            mapOf(
                                "total" to JsonPrimitive(current["total"].number() + amount),
                                "used" to JsonPrimitive(current["used"].number() + moved),
                            )
                    )
                if (at < 0) actual.add(next) else actual[at] = next
            }
        }
        pools[pool] =
            JsonArray(actual.filter { it["total"].number() > 0 }.sortedBy { it["level"].number() })
    }
    result["slot_pools"] = JsonObject(pools)
    val tabs = old["tabs"].arrayValue().map { it.objectValue() }.toMutableList()
    val classItem = plan.charClass!!
    val casting =
        (plan.subclass?.data?.get("spellcasting") ?: classItem.data["spellcasting"]).objectValue()
    if (casterKind(classItem, plan.subclass).isNotBlank()) {
        val at = tabs.indexOfFirst { it["class_item_id"].referenceId() == classItem.id }
        val tab =
            tabs.getOrNull(at)
                ?: buildJsonObject {
                    put("key", "class:${classItem.id}")
                    put("name", classItem.name)
                    put("class_item_id", classItem.id)
                    put(
                        "casting_ability",
                        casting["ability"]
                            ?: classItem.data["spellcasting_ability"]
                            ?: JsonPrimitive(0),
                    )
                    put("mode", casting.text("mode").ifBlank { "known" })
                    put("spells", JsonArray(emptyList()))
                }
        val selected = plan.input["spells"].arrayValue()
        val previous = tab["spells"].arrayValue()
        val next =
            if (plan.input["spells"] == null) tab
            else
                JsonObject(
                    tab +
                        ("spells" to
                            JsonArray(
                                selected.map { id ->
                                    previous.firstOrNull { it.referenceId() == id.referenceId() }
                                        ?: buildJsonObject {
                                            put("id", id)
                                            put("key", java.util.UUID.randomUUID().toString())
                                            put("prepared", tab.text("mode") == "prepared")
                                        }
                                }
                            ))
                )
        if (at < 0) tabs.add(next) else tabs[at] = next
    }
    result["tabs"] = JsonArray(tabs)
    val grants = old["grants"].arrayValue().toMutableList()
    val labels =
        (values["feature_choices"].objectValue().values.flatMap { it.arrayValue() } +
                plan.input["choices"].objectValue().values.flatMap {
                    it.objectValue().values.flatMap { value -> value.arrayValue() }
                })
            .map { it.jsonPrimitive.content }
    for (source in listOfNotNull(plan.charClass, plan.subclass)) for (raw in
        source.data["granted_spells"].arrayValue()) {
        val row = raw.objectValue()
        val id = row["spell"].referenceId() ?: continue
        if (
            row["level"].number(1) > plan.classLevel ||
                row.text("option").let { it.isNotBlank() && it !in labels }
        )
            continue
        val key = "class:${source.id}:spell:$id"
        if (grants.none { it.objectValue().text("key") == key })
            grants.add(
                buildJsonObject {
                    put("key", key)
                    put("id", id)
                    put("tab_key", "class:${plan.classId}")
                    put(
                        "source",
                        buildJsonObject {
                            put("kind", "class")
                            put("item_id", source.id)
                            put("label", source.name)
                        },
                    )
                }
            )
    }
    result["grants"] =
        syncAbilitySpellGrants(
            plan.sheet.copy(data = JsonObject(plan.sheet.data + ("values" to JsonObject(values)))),
            plan.items,
            grants,
        )
    values["spells"] = JsonObject(result)
}

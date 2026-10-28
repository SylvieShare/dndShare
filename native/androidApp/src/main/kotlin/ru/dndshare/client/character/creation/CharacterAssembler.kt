package ru.dndshare.client.character.creation

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

fun assembleCharacter(
    context: CreationContext,
    includePossessions: Boolean = true,
    stableIds: Boolean = false,
): JsonObject {
    val draft = context.draft
    if (draft.template == "VTM20")
        return buildJsonObject {
            put(
                "values",
                buildJsonObject {
                    put("char_name", draft.name.trim())
                    draft.portraitUpload?.let { put("ava", it) }
                },
            )
        }
    val values = mutableMapOf<String, JsonElement>()
    fun ref(item: CatalogueItem?) =
        item?.let {
            buildJsonObject {
                put("id", it.id)
                put("name", it.name)
            }
        } ?: JsonNull
    values["name"] = JsonPrimitive(draft.name.trim())
    draft.portraitUpload?.let { values["ava"] = it }
    values["lvl"] = buildJsonObject {
        put("level", 1)
        put("exp", 0)
    }
    values["race"] = ref(context.item("race"))
    context.item("subrace")?.let { values["subrace"] = ref(it) }
    if (draft.raceVariant.isNotBlank()) values["race_variant"] = JsonPrimitive(draft.raceVariant)
    context.item("charClass")?.let { item ->
        values["classes"] =
            JsonArray(
                listOf(
                    JsonObject(
                        ref(item).jsonObject +
                            mapOf(
                                "level" to JsonPrimitive(1),
                                "subclass" to ref(context.item("subclass")),
                            )
                    )
                )
            )
    }
    values["speed"] = buildJsonObject {
        put(
            "base",
            context.raceOffers.lastOrNull { it["speed"] != null }?.get("speed")?.number() ?: 30,
        )
        put("bonuses", JsonArray(emptyList()))
    }
    values["armor"] = buildJsonObject { put("bonuses", JsonArray(emptyList())) }
    values["initiative"] = buildJsonObject {
        put("base", 0)
        put("bonuses", JsonArray(emptyList()))
        put("use_dex", true)
    }
    values["prof_bonus"] = buildJsonObject {
        put("v", 2)
        put("auto", true)
    }
    values["inspiration"] = JsonPrimitive(false)
    val featSelections = creationFeatSelections(context, stableIds)
    val finalScores = applyCreationAttributes(context, featSelections, values)
    val profs = linkedMapOf<String, MutableSet<String>>()
    fun proficiency(bucket: String, type: String, ids: List<Long>) {
        val labels = ids.map { context.label(type, it) }.filter(String::isNotBlank)
        if (labels.isNotEmpty()) profs.getOrPut(bucket) { linkedSetOf() }.addAll(labels)
    }
    val sources = context.raceData + context.classData
    for ((key, bucket, type) in
        listOf(
            Triple("armor_prof", "Доспехи", "3"),
            Triple("weapon_prof", "Оружие", "4"),
            Triple("tool_prof", "Инструменты", "5"),
        )) proficiency(
        bucket,
        type,
        sources.flatMap { it[key].arrayValue().mapNotNull { id -> id.referenceId() } },
    )
    proficiency("Инструменты", "5", context.picked("classTools").mapNotNull(String::toLongOrNull))
    val bg = context.item("background")?.data.objectValue()
    val replaced =
        bg["item_choices"].arrayValue().filter {
            it.objectValue()["grants_tool_proficiency"] == JsonPrimitive(true)
        }
    val replacedIds = replaced.mapNotNull { it.objectValue()["replace_tool_prof_id"].referenceId() }
    proficiency(
        "Инструменты",
        "5",
        bg["tool_prof"].arrayValue().mapNotNull { it.referenceId() }.filter { it !in replacedIds },
    )
    for (row in replaced) {
        val choice = row.objectValue()
        val selected =
            context
                .picked("background:${choice.text("key")}")
                .firstOrNull()
                ?.toLongOrNull()
                ?.let(context.items::get)
        if (selected != null) profs.getOrPut("Инструменты") { linkedSetOf() }.add(selected.name)
    }
    proficiency(
        "Языки",
        "6",
        (context.raceData + listOf(bg)).flatMap {
            it["languages"].arrayValue().mapNotNull { id -> id.referenceId() }
        } +
            (context.picked("raceLanguages") + context.picked("backgroundLanguages")).mapNotNull(
                String::toLongOrNull
            ),
    )
    for (raw in context.classData.flatMap { it["saves"].arrayValue() }) creationStats
        .getOrNull(raw.number() - 1)
        ?.let { stat ->
            values[stat] =
                JsonObject(values[stat].objectValue() + ("save_up" to JsonPrimitive(true)))
        }
    fun skill(id: Long, rank: Int = 1) {
        val stat = skillStat(id) ?: return
        val data = values[stat].objectValue()
        val skills = data["skills"].objectValue()
        val existing = skills[id.toString()].objectValue()
        values[stat] =
            JsonObject(
                data +
                    ("skills" to
                        JsonObject(
                            skills +
                                (id.toString() to
                                    JsonObject(
                                        existing +
                                            mapOf(
                                                "up" to
                                                    JsonPrimitive(
                                                        maxOf(rank, existing["up"].number())
                                                    ),
                                                "override_title" to JsonPrimitive(""),
                                                "bonuses" to JsonArray(emptyList()),
                                            )
                                    ))
                        ))
            )
    }
    val skills =
        context.raceData.flatMap {
            it["skill_prof"].arrayValue().mapNotNull { id -> id.referenceId() }
        } +
            bg["skills"].arrayValue().mapNotNull { it.referenceId() } +
            (context.picked("classSkills") + context.picked("raceSkills")).mapNotNull(
                String::toLongOrNull
            )
    skills.forEach { skill(it) }
    applyCreationFeatureGrants(context, featSelections, values, ::proficiency, ::skill)
    values["proficiencies"] =
        JsonObject(profs.mapValues { JsonArray(it.value.map(::JsonPrimitive)) })
    fun entries(list: List<CatalogueItem>): JsonArray =
        JsonArray(
            list.map { item ->
                buildJsonObject {
                    put("id", item.id)
                    val choices =
                        itemChoices(item)
                            .associate {
                                it.text("key") to
                                    JsonArray(
                                        context.picked("${item.id}|${it.text("key")}").map { value
                                            ->
                                            value.toLongOrNull()?.let(::JsonPrimitive)
                                                ?: JsonPrimitive(value)
                                        }
                                    )
                            }
                            .filterValues { it.isNotEmpty() }
                    if (choices.isNotEmpty()) put("choices", JsonObject(choices))
                    if (item.data["selection_parent_id"].referenceId() != null) {
                        put(
                            "uid",
                            if (stableIds) "preview:" + item.id else UUID.randomUUID().toString(),
                        )
                        put("selection_source", item.data.getValue("selection_parent_id"))
                    }
                }
            }
        )
    values["abilities_race"] = entries(context.features(true))
    values["abilities_class"] = entries(context.features(false))
    if (featSelections.isNotEmpty())
        values["abilities_feats"] = JsonArray(featSelections.map { creationFeatEntry(it, values) })
    val variantDefenses = context.variant?.get("defenses").arrayValue()
    if (variantDefenses.isNotEmpty()) values["defenses"] = JsonArray(variantDefenses)
    val face =
        context.classData
            .lastOrNull { it["hit_die"] != null }
            ?.text("hit_die")
            ?.filter(Char::isDigit)
            ?.toIntOrNull() ?: 8
    val hp = face + abilityModifier(finalScores["CON"] ?: 10)
    values["hp"] = buildJsonObject {
        put(
            "max",
            buildJsonObject {
                put("base", hp)
                put("bonuses", JsonArray(emptyList()))
            },
        )
        put("current", hp)
        put(
            "hitDice",
            buildJsonArray {
                add(
                    buildJsonObject {
                        put("die", "d$face")
                        put("total", 1)
                        put("used", 0)
                    }
                )
            },
        )
        context.item("charClass")?.let { item ->
            put(
                "history",
                buildJsonArray {
                    add(
                        buildJsonObject {
                            put("kind", "level")
                            put("level", 1)
                            put("classId", item.id)
                            put("className", item.name)
                            put("classLevel", 1)
                            put("gain", hp)
                        }
                    )
                },
            )
        }
    }
    if (includePossessions) applyStartingPossessions(context, values)
    for ((key, value) in draft.persona) if (value.isNotBlank())
        values[if (key == "notes") key else "person_$key"] = JsonPrimitive(value)
    context.item("background")?.let { item ->
        values["background"] = ref(item)
        values["person_origin"] = JsonPrimitive(item.name)
        if (item.data.text("feature").isNotBlank() || item.data.text("feature_desc").isNotBlank())
            values["notes"] =
                JsonPrimitive(
                    "Умение предыстории — ${item.data.text("feature")}: ${item.data.text("feature_desc")}"
                )
    }
    val spells = creationSpellbook(context, JsonObject(values), stableIds, featSelections)
    if (
        spells["tabs"].arrayValue().isNotEmpty() ||
            spells["grants"].arrayValue().isNotEmpty() ||
            spells["slot_pools"].objectValue().values.any { it.arrayValue().isNotEmpty() }
    )
        values["spells"] = spells
    return buildJsonObject {
        put("values", JsonObject(values))
        put("settings", buildJsonObject { put("contentSources", draft.contentSources) })
    }
}

fun skillStat(id: Long): String? =
    when (id) {
        1L -> "STR"
        in 2L..4L -> "DEX"
        in 5L..9L -> "INT"
        in 10L..14L -> "WIS"
        in 15L..18L -> "CHA"
        else -> null
    }

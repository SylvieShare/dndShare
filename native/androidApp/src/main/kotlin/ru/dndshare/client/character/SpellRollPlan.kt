package ru.dndshare.client.character

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

fun spellSavingThrow(rule: JsonObject, readout: SpellReadout, sheet: CharacterSheet): JsonObject? {
    val ability =
        listOf("str", "dex", "con", "int", "wis", "cha").indexOf(rule.text("save_ability")) + 1
    if (ability == 0) return null
    val fixed = rule["save_dc"].number().takeIf { it in 1..100 }
    val dc =
        fixed
            ?: (8 +
                sheet.proficiency() +
                readout.modifier +
                (readout.tab?.get("save_bonus")).number())
    return buildJsonObject {
        put("ability", ability)
        put("dc", dc)
        put("onSuccess", rule.text("save_effect"))
        put("condition", rule.text("save_condition"))
        put("results", JsonArray(emptyList()))
    }
}

fun spellRollRequest(
    sheet: CharacterSheet,
    key: String,
    options: SpellRollOptions,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): SheetRollRequest {
    val readout = spellReadout(sheet, key, items, metadata)
    require(!spellCastingBlocked(sheet, items, metadata)) {
        "Активный эффект или отсутствие владения доспехом запрещает сотворение заклинаний."
    }
    val base = readout.item.data["lvl"].number()
    require(options.castLevel in base..9 && (base != 0 || options.castLevel == 0)) {
        "Выберите круг заклинания."
    }
    val encoded = WireJson.parseToJsonElement(WireJson.encodeToString(options)).jsonObject
    if (options.kind == "attack") {
        require(readout.item.data["damage"].objectValue()["range_attack"] == JsonPrimitive(true)) {
            "Для этого заклинания не предусмотрен бросок атаки."
        }
        val allowed =
            readout.item.data["damage"]
                .objectValue()["type_choices"]
                .arrayValue()
                .mapNotNull { it.referenceId() }
                .distinct()
        val type = options.damageType ?: allowed.singleOrNull()
        require(allowed.isEmpty() || type in allowed) { "Выберите тип урона атаки." }
        return SheetRollRequest(
            "Атака: ${readout.item.name}",
            "attack",
            ability = readout.ability,
            bonus = readout.attack,
            manualMode = options.mode,
            sourceItemId = readout.item.id,
            sourceName = readout.item.name,
            proficiencyRank = 1,
            excludedBonuses = options.excludedBonuses,
            spellKey = key,
            spellOptions = encoded,
            eventData =
                buildJsonObject {
                    spellSequenceSnapshot(sheet, readout, options, items, metadata)?.let {
                        put("sequence", it)
                    }
                    put("entryKey", key)
                    put("castLevel", options.castLevel)
                    metadata.suggests["12"]
                        .orEmpty()
                        .firstOrNull { it.id == type }
                        ?.let {
                            put(
                                "damageType",
                                buildJsonObject {
                                    put("id", it.id)
                                    put("label", it.value)
                                    it.color?.let { color -> put("color", color) }
                                },
                            )
                        }
                },
        )
    }
    val option =
        spellRuleOptions(readout.item).firstOrNull { it.key == options.optionKey }
            ?: error("Вариант броска больше недоступен.")
    val terms = spellRollTerms(sheet, readout, option, options, items, metadata)
    require(terms.isNotEmpty()) { "У этого эффекта не задана формула броска." }
    val title =
        when (option.kind) {
            "damage" -> if (options.critical) "Критический урон" else "Урон"
            "heal" ->
                if (option.rule.text("kind") == "temporary_hp") "Временные хиты" else "Лечение"
            else -> "Эффект"
        }
    val formula = terms.joinToString("+") { it.expression }.replace("+-", "-")
    val event = buildJsonObject {
        if (option.kind == "heal" && option.rule.text("kind") == "temporary_hp")
            put("temporaryHp", true)
        put("entryKey", key)
        put("castLevel", options.castLevel)
        if (option.kind != "heal") {
            if (option.rule["save_manual"] != JsonPrimitive(true))
                spellSavingThrow(option.rule, readout, sheet)?.let { put("savingThrow", it) }
            val type =
                options.damageType
                    ?: option.rule["type_choices"].arrayValue().singleOrNull()?.referenceId()
            metadata.suggests["12"]
                .orEmpty()
                .firstOrNull { it.id == type }
                ?.let {
                    put(
                        "damageType",
                        buildJsonObject {
                            put("id", it.id)
                            put("label", it.value)
                            it.color?.let { color -> put("color", color) }
                        },
                    )
                }
        }
    }
    return SheetRollRequest(
        "$title: ${readout.item.name}${if(option.key.startsWith("effect:")) " — ${option.label}" else ""}",
        option.kind,
        formula = formula,
        sourceItemId = readout.item.id,
        sourceName = readout.item.name,
        damageTerms = terms,
        spellKey = key,
        spellOptions = encoded,
        eventData = event,
    )
}

fun endingStatusPatches(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    trigger: String,
): List<SheetPatch> {
    val before = sheet.values["states"].arrayValue()
    val next = before.filterNot { row ->
        items[row.objectValue()["effect_id"].referenceId()]?.data?.get("end_on").arrayValue().any {
            it.jsonPrimitive.content == trigger
        }
    }
    return if (before == next) emptyList()
    else
        listOf(
            SheetPatch(
                path = sheetPath("values", "states"),
                value = JsonArray(withStatusEndEffects(before, next, items)),
            )
        )
}

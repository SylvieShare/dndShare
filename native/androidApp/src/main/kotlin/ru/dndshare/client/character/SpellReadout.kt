package ru.dndshare.client.character

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

@Serializable
data class SpellRollOptions(
    val kind: String = "attack",
    val optionKey: String = "damage",
    val castLevel: Int = 0,
    val critical: Boolean = false,
    val damageType: Long? = null,
    val mode: String = "auto",
    val excludedBonuses: List<String> = emptyList(),
    val typeChoices: Map<String, Long> = emptyMap(),
)

data class SpellReadout(
    val item: CatalogueItem,
    val reference: JsonObject,
    val tab: JsonObject?,
    val ability: Long?,
    val modifier: Int,
    val attack: Int,
    val save: Int,
    val characterLevel: Int,
)

fun spellReadout(
    sheet: CharacterSheet,
    key: String,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): SpellReadout {
    val ref = findSpellReference(sheet, key) ?: error("Заклинания больше нет в книге.")
    val item = items[ref.referenceId()] ?: error("Дождитесь загрузки описания заклинания.")
    val tabs = sheet.values["spells"].objectValue()["tabs"].arrayValue().map { it.objectValue() }
    val tab =
        if (ref["source"] is JsonObject) tabs.firstOrNull { it.text("key") == ref.text("tab_key") }
        else
            tabs.firstOrNull { tab ->
                tab["spells"].arrayValue().any { it.objectValue().text("key") == key }
            }
    val ability =
        (ref["casting_ability"] ?: tab?.get("casting_ability")).referenceId()?.takeIf { it in 1..6 }
    val derived = DndDerivedValues(sheet, items, metadata)
    val modifier =
        ability?.let {
            abilityModifier(
                derived.score(listOf("STR", "DEX", "CON", "INT", "WIS", "CHA")[it.toInt() - 1])
            )
        } ?: 0
    val calculated = 8 + sheet.proficiency() + modifier + (tab?.get("save_bonus")).number()
    val fixed = item.data["damage"].objectValue()["save_dc"].number().takeIf { it in 1..100 }
    return SpellReadout(
        item,
        ref,
        tab,
        ability,
        modifier,
        sheet.proficiency() + modifier + (tab?.get("attack_bonus")).number(),
        fixed ?: calculated,
        sheet.values["lvl"].objectValue()["level"].number(1),
    )
}

fun spellScalingSteps(rule: JsonObject, base: Int, castLevel: Int, charLevel: Int): Int =
    when (rule.text("scaling")) {
        "slot" -> {
            val cast = castLevel.takeIf { it > 0 } ?: base
            val explicit = rule["scaling_levels"].arrayValue()
            if (explicit.isNotEmpty()) explicit.count { it.objectValue()["level"].number() <= cast }
            else {
                val steps =
                    (cast - base).coerceAtLeast(0) / rule["scaling_step"].number(1).coerceAtLeast(1)
                if (rule["scaling_max_steps"] != null && rule["scaling_max_steps"] != JsonNull)
                    minOf(steps, rule["scaling_max_steps"].number().coerceAtLeast(0))
                else steps
            }
        }
        "cantrip" ->
            when {
                charLevel >= 17 -> 3
                charLevel >= 11 -> 2
                charLevel >= 5 -> 1
                else -> 0
            }
        else -> 0
    }

data class SpellRuleOption(
    val key: String,
    val kind: String,
    val label: String,
    val rule: JsonObject,
)

fun spellRuleOptions(item: CatalogueItem): List<SpellRuleOption> = buildList {
    for (kind in listOf("damage", "heal")) {
        val rule = item.data[kind].objectValue()
        if (rule["dices"].arrayValue().isNotEmpty())
            add(SpellRuleOption(kind, kind, if (kind == "damage") "Урон" else "Лечение", rule))
    }
    for ((index, raw) in item.data["rolls"].arrayValue().withIndex()) {
        var rule = raw.objectValue()
        val kind = rule.text("kind").ifBlank { "effect" }
        if (
            kind == "damage" &&
                (rule["type_choices"] == null || rule["type_choices"] == JsonNull) &&
                item.data["damage"].objectValue()["type_choices"].arrayValue().isNotEmpty() &&
                (rule["dices"].arrayValue() + rule["addon"].arrayValue()).any {
                    it.objectValue()["type"].referenceId() == null
                }
        )
            rule =
                JsonObject(
                    rule +
                        ("type_choices" to
                            item.data["damage"].objectValue().getValue("type_choices"))
                )
        add(SpellRuleOption("effect:$index", kind, rule.text("label").ifBlank { "Эффект" }, rule))
    }
}

fun spellRollTerms(
    sheet: CharacterSheet,
    readout: SpellReadout,
    option: SpellRuleOption,
    options: SpellRollOptions,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): List<SheetDamageTerm> {
    val rule = option.rule
    val allowed =
        rule["type_choices"]
            .arrayValue()
            .mapNotNull { it.referenceId() }
            .filter { it > 0 }
            .distinct()
    val type = options.damageType ?: allowed.singleOrNull()
    require(allowed.isEmpty() || type in allowed) { "Выберите тип урона." }
    val steps =
        spellScalingSteps(
            rule,
            readout.item.data["lvl"].number(),
            options.castLevel,
            readout.characterLevel,
        )
    val rows = rule["dices"].arrayValue().map { it.objectValue() }.toMutableList()
    if (steps > 0)
        for (raw in rule["addon"].arrayValue()) {
            val addon = raw.objectValue()
            val index = rows.indexOfFirst {
                it["dice_id"] == addon["dice_id"] &&
                    (it["type"] ?: JsonNull) == (addon["type"] ?: JsonNull)
            }
            if (index >= 0)
                rows[index] =
                    JsonObject(
                        rows[index] +
                            mapOf(
                                "count" to
                                    JsonPrimitive(
                                        rows[index]["count"].number() +
                                            addon["count"].number() * steps
                                    ),
                                "bonus" to
                                    JsonPrimitive(
                                        rows[index]["bonus"].number() +
                                            addon["bonus"].number() * steps
                                    ),
                            )
                    )
            else
                rows.add(
                    JsonObject(
                        addon +
                            mapOf(
                                "count" to JsonPrimitive(addon["count"].number() * steps),
                                "bonus" to JsonPrimitive(addon["bonus"].number() * steps),
                            )
                    )
                )
        }
    var modifier = if (rule["add_mod"] == JsonPrimitive(true)) readout.modifier else 0
    if (option.kind != "heal")
        for (feature in ownedFeatures(sheet, items)) {
            if (
                feature.item.typeId == 19L &&
                    !magicActive(feature.item, feature.instance, feature.equipped, sheet) ||
                    ownerLevel(feature.item.data, sheet) < feature.item.data["level"].number(1)
            )
                continue
            for (raw in feature.item.data["spell_modifiers"].arrayValue()) {
                val bonus = raw.objectValue()
                if (bonus["spell_id"].referenceId() != readout.item.id) continue
                bonus["damage_ability"]
                    .referenceId()
                    ?.takeIf { it in 1..6 }
                    ?.let {
                        modifier +=
                            abilityModifier(
                                sheet.statScore(
                                    listOf("STR", "DEX", "CON", "INT", "WIS", "CHA")[it.toInt() - 1]
                                )
                            )
                    }
            }
        }
    return rows.flatMapIndexed { index, row ->
        val rawDie = row.text("dice_id")
        val die =
            metadata.suggests["1"].orEmpty().firstOrNull { it.id.toString() == rawDie }?.value
                ?: rawDie
        val sides = die.filter(Char::isDigit).toIntOrNull()
        val damageType =
            (row["type"].referenceId() ?: type)?.let { id ->
                metadata.suggests["12"].orEmpty().firstOrNull { it.id == id }
            }
        val label = if (option.kind == "heal") "" else damageType?.value.orEmpty()
        val color = if (option.kind == "heal") "" else damageType?.color.orEmpty()
        val count = row["count"].number(1).takeIf { it != 0 } ?: 1
        val bonus = row["bonus"].number() + if (index == 0) modifier else 0
        buildList {
            if (sides != null)
                add(
                    SheetDamageTerm(
                        "${count*if(options.critical && option.kind!="heal")2 else 1}d$sides",
                        label,
                        color,
                    )
                )
            if (bonus != 0) add(SheetDamageTerm(bonus.toString(), label, color))
        }
    }
}

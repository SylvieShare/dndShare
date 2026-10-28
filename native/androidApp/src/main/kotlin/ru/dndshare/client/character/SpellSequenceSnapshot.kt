package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

/**
 * Chronicle owns all continuation/target resolution; freeze exactly the rules used for this cast.
 */
fun spellSequenceSnapshot(
    sheet: CharacterSheet,
    readout: SpellReadout,
    options: SpellRollOptions,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): JsonObject? {
    val rule = readout.item.data["damage"].objectValue()
    if (rule["roll_table"] !is JsonObject && rule["attack_chain"] !is JsonObject) return null
    val base = readout.item.data["lvl"].number()
    val steps = spellScalingSteps(rule, base, options.castLevel, readout.characterLevel)
    fun expression(critical: Boolean): String {
        val damage = spellRuleOptions(readout.item).first { it.key == "damage" }
        return spellRollTerms(
                sheet,
                readout,
                damage,
                options.copy(kind = "damage", optionKey = "damage", critical = critical),
                items,
                metadata,
            )
            .joinToString("+") { term ->
                term.expression +
                    if (term.label.isBlank()) ""
                    else "{${term.label}${if(term.color.isBlank()) "" else "|${term.color}"}}"
            }
            .replace("+-", "-")
    }
    val derived = DndDerivedValues(sheet, items, metadata)
    val context = RuleContext(kind = "attack", ability = readout.ability, proficient = true)
    val bonusFormula =
        derived
            .rules("roll_bonus", context)
            .filter { it.rule.text("key") !in options.excludedBonuses }
            .map { it.rule.text("formula") }
            .filter(String::isNotBlank)
            .joinToString("+")
    return buildJsonObject {
        put("range", readout.item.data["range"].objectValue()["distance"] ?: JsonNull)
        put("table", rule["roll_table"] ?: JsonNull)
        put("chain", rule["attack_chain"] ?: JsonNull)
        put("baseLevel", base)
        put("castLevel", options.castLevel)
        put("charLevel", readout.characterLevel)
        put("attackBonus", readout.attack)
        put("attackBonusFormula", bonusFormula)
        put("damageExpression", expression(false))
        put("criticalExpression", expression(true))
        put(
            "instances",
            (rule["instances"].number(1) + rule["addon_instances"].number() * steps).coerceAtLeast(
                1
            ),
        )
        put("projectile", 1)
        put("revision", 0)
    }
}

fun completeSpellSequenceSnapshot(template: JsonObject, attack: SheetRollResult): JsonObject =
    JsonObject(
        template +
            ("hits" to
                buildJsonArray {
                    add(
                        buildJsonObject {
                            put("attack", diceResultData(attack))
                            put("status", "target")
                        }
                    )
                })
    )

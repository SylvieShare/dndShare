package ru.dndshare.client.character

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

@Serializable
data class RollTriggerAction(
    val key: String,
    val label: String,
    val event: String,
    val useUid: String = "",
    val useKey: String = "",
)

fun rollTriggerCandidates(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    request: SheetRollRequest,
    owner: Boolean,
): List<RollTriggerAction> {
    val scope = if (request.kind == "skill_check") "ability_check" else request.kind
    return combatRules(sheet, items, "roll_triggers").mapNotNull { rule ->
        if (rule.text("action") != "reroll" || rule.text("event") !in setOf("any", "natural_one"))
            return@mapNotNull null
        val scopes = rule["scopes"].arrayValue()
        if (scopes.isNotEmpty() && scopes.none { it.jsonPrimitive.content == scope })
            return@mapNotNull null
        val useKey = rule.text("use_key")
        val uid =
            if (useKey.isBlank()) "" else rule["resource_owner"].objectValue().text("entryKey")
        if (useKey.isNotBlank()) {
            if (!owner) return@mapNotNull null
            val use =
                confirmedItemUses(sheet, items, uid).firstOrNull { it.key == useKey }
                    ?: return@mapNotNull null
            if (use.error.isNotBlank()) return@mapNotNull null
        }
        RollTriggerAction(
            rule.text("key"),
            rule.text("label").ifBlank { "Перебросить — " + rule.text("source_label") },
            rule.text("event"),
            uid,
            useKey,
        )
    }
}

fun revalidateRollTrigger(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    record: SheetRollRecord,
    key: String,
    owner: Boolean,
): RollTriggerAction {
    val useId = record.request.eventData.text("weaponUseId")
    if (useId.isNotBlank()) {
        val use = weaponUseState(sheet, record.request.targetUid)
        require(use.text("id") == useId && use.text("status") == "active") {
            "Это применение оружия уже завершено."
        }
    }

    val original =
        record.actions().firstOrNull { it.key == key }
            ?: error("Этот переброс уже использован или недоступен.")
    return rollTriggerCandidates(sheet, items, record.request, owner).firstOrNull {
        it.key == original.key && it.useUid == original.useUid && it.useKey == original.useKey
    } ?: error("Свойство или его ресурс больше недоступны.")
}

/** Reroll the bonus dice again, preserving the first roll's rules after temporary effects end. */
fun rerollPreparedD20(plan: PreparedD20Roll): PreparedD20Roll {
    if (plan.bonusExpression.isBlank()) return plan
    val rolled = rollDice(plan.bonusExpression.replace("+-", "-"))
    return plan.copy(bonusDice = rolled.dice, bonusTotal = rolled.total, bonusParts = rolled.parts)
}

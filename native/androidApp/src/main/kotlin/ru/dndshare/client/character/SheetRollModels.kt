package ru.dndshare.client.character

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*

@Serializable
data class SheetDamageTerm(val expression: String, val label: String = "", val color: String = "")

@Serializable
data class SheetRollRequest(
    val title: String,
    val kind: String = "ability_check",
    val ability: Long? = null,
    val skill: Long? = null,
    val bonus: Int = 0,
    val manualMode: String = "auto",
    val formula: String? = null,
    val weaponAttack: Boolean = false,
    val weaponKind: String = "",
    val improvised: Boolean = false,
    val targetUid: String = "",
    val sourceItemId: Long? = null,
    val sourceName: String = "",
    val criticalThreshold: Int = 20,
    val proficiencyRank: Int = 0,
    val excludedBonuses: List<String> = emptyList(),
    val damageTerms: List<SheetDamageTerm> = emptyList(),
    val weaponOptions: JsonObject? = null,
    val minimumTotal: Int? = null,
    val spellKey: String = "",
    val spellOptions: JsonObject? = null,
    val eventData: JsonObject = JsonObject(emptyMap()),
    val repeatable: Boolean = true,
)

@Serializable
data class SheetRollResult(
    val title: String,
    val mode: String,
    val rolls: List<Int>,
    val selected: Int?,
    val bonus: Int,
    val bonusDice: List<Int> = emptyList(),
    val total: Int,
    val sources: List<String> = emptyList(),
    val parts: List<JsonObject> = emptyList(),
    val byType: List<JsonObject> = emptyList(),
    val expression: String = "",
    val adjustments: List<JsonObject> = emptyList(),
    val karmicDice: JsonObject? = null,
)

fun SheetRollRequest.ruleContext() =
    RuleContext(
        kind = kind,
        ability = ability,
        skill = skill,
        target = targetUid.takeIf(String::isNotBlank)?.let(::JsonPrimitive),
        proficient = proficiencyRank > 0,
        weaponAttack = weaponAttack,
        weaponKind = weaponKind,
        improvised = improvised,
    )

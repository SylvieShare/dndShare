package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.creation.statTitles
import ru.dndshare.client.model.*

fun diceResultData(result: SheetRollResult): JsonObject = buildJsonObject {
    put("parts", JsonArray(result.parts))
    put("byType", JsonArray(result.byType))
    put("total", result.total)
    put("expression", result.expression)
    put("rollMode", result.mode)
    result.karmicDice?.let { put("karmicDice", it) }
    if (result.adjustments.isNotEmpty()) put("adjustments", JsonArray(result.adjustments))
}

fun diceEventData(request: SheetRollRequest, result: SheetRollResult): JsonObject =
    buildJsonObject {
        request.eventData.forEach { (key, value) -> put(key, value) }
        if (request.kind == "attack")
            (request.eventData["sequence"] as? JsonObject)?.let {
                put("sequence", completeSpellSequenceSnapshot(it, result))
            }
        put("title", request.title)
        put("kind", request.kind)
        put("result", diceResultData(result))
        if (request.kind == "attack") put("attackRoll", true)
        if (request.kind == "damage") put("damageRoll", true)
        request.sourceItemId
            ?.takeIf { it > 0 }
            ?.let { id ->
                put(
                    "source",
                    buildJsonObject {
                        put("itemId", id)
                        put("name", request.sourceName)
                        if (request.targetUid.isNotBlank()) put("instanceUid", request.targetUid)
                    },
                )
            }
        request.ability
            ?.takeIf { it in 1..6 }
            ?.let { id ->
                put(
                    "ability",
                    buildJsonObject {
                        put("id", id)
                        put("typeId", 16)
                        put("name", statTitles[(id - 1).toInt()])
                    },
                )
            }
        val natural = result.selected
        if (natural != null && natural >= request.criticalThreshold)
            put(
                "outcome",
                buildJsonObject {
                    put("kind", "crit")
                    put("sides", 20)
                    put("value", natural)
                },
            )
        else if (natural == 1 && result.adjustments.isEmpty())
            put(
                "outcome",
                buildJsonObject {
                    put("kind", "fumble")
                    put("sides", 20)
                    put("value", 1)
                },
            )
    }

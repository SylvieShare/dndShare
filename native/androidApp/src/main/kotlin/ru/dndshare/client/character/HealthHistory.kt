package ru.dndshare.client.character

import kotlinx.serialization.json.*

fun normalizedHpMaximum(raw: JsonElement?): JsonObject =
    if (raw is JsonObject)
        JsonObject(
            raw +
                mapOf(
                    "base" to JsonPrimitive(raw["base"].number().coerceAtLeast(0)),
                    "bonuses" to JsonArray(raw["bonuses"].arrayValue()),
                )
        )
    else
        buildJsonObject {
            put("base", raw.number().coerceAtLeast(0))
            put("bonuses", JsonArray(emptyList()))
        }

fun appendHealthHistory(hp: JsonObject, entry: JsonObject): JsonArray {
    val history = hp["history"].arrayValue().toMutableList()
    val remaining =
        normalizedHpMaximum(hp["max"])["base"].number() -
            history.sumOf { it.objectValue()["gain"].number() }
    if (remaining != 0)
        history.add(
            buildJsonObject {
                put("kind", "untracked")
                put("gain", remaining)
            }
        )
    history.add(entry)
    return JsonArray(history)
}

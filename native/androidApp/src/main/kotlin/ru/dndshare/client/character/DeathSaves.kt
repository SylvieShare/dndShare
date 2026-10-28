package ru.dndshare.client.character

import kotlinx.serialization.json.*

fun deathSaveChange(hp: JsonObject, key: String, index: Int): JsonObject {
    require(hp["current"].number() <= 0) { "Персонаж уже пришёл в сознание." }
    require(key in listOf("ds_success", "ds_failure") && index in 1..3)
    val current = hp[key].number().coerceIn(0, 3)
    val next = if (current == index) index - 1 else index
    return if (key == "ds_success" && next == 3)
        JsonObject(
            hp +
                mapOf(
                    "current" to JsonPrimitive(1),
                    "ds_success" to JsonPrimitive(0),
                    "ds_failure" to JsonPrimitive(0),
                )
        )
    else JsonObject(hp + (key to JsonPrimitive(next)))
}

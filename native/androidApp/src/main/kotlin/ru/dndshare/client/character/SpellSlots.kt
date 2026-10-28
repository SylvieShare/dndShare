package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

private val fullCasterSlots =
    listOf(
        listOf(2),
        listOf(3),
        listOf(4, 2),
        listOf(4, 3),
        listOf(4, 3, 2),
        listOf(4, 3, 3),
        listOf(4, 3, 3, 1),
        listOf(4, 3, 3, 2),
        listOf(4, 3, 3, 3, 1),
        listOf(4, 3, 3, 3, 2),
        listOf(4, 3, 3, 3, 2, 1),
        listOf(4, 3, 3, 3, 2, 1),
        listOf(4, 3, 3, 3, 2, 1, 1),
        listOf(4, 3, 3, 3, 2, 1, 1),
        listOf(4, 3, 3, 3, 2, 1, 1, 1),
        listOf(4, 3, 3, 3, 2, 1, 1, 1),
        listOf(4, 3, 3, 3, 2, 1, 1, 1, 1),
        listOf(4, 3, 3, 3, 3, 1, 1, 1, 1),
        listOf(4, 3, 3, 3, 3, 2, 1, 1, 1),
        listOf(4, 3, 3, 3, 3, 2, 2, 1, 1),
    )

fun casterKind(item: CatalogueItem?, subclass: CatalogueItem?): String =
    listOfNotNull(subclass, item)
        .firstNotNullOfOrNull { candidate ->
            candidate.data
                .text("caster_progression")
                .ifBlank { candidate.data["spellcasting"].objectValue().text("progression") }
                .takeIf { it in setOf("full", "half", "halfup", "third", "pact") }
        }
        .orEmpty()

fun spellSlotPools(
    classes: List<JsonObject>,
    items: Map<Long, CatalogueItem>,
    previous: JsonObject = JsonObject(emptyMap()),
): JsonObject {
    val rows = classes.map { row ->
        row["level"].number().coerceIn(0, 20) to
            casterKind(items[row["id"].referenceId()], items[row["subclass"].referenceId()])
    }
    val ordinary = rows.filter { it.second.isNotBlank() && it.second != "pact" }
    val level =
        ordinary
            .sumOf { (level, kind) ->
                when (kind) {
                    "full" -> level
                    "halfup" -> (level + 1) / 2
                    "half" ->
                        if (ordinary.size == 1) {
                            if (level < 2) 0 else (level + 1) / 2
                        } else level / 2
                    "third" ->
                        if (ordinary.size == 1) {
                            if (level < 3) 0 else (level + 2) / 3
                        } else level / 3
                    else -> 0
                }
            }
            .coerceIn(0, 20)
    val pactLevel = rows.filter { it.second == "pact" }.sumOf { it.first }.coerceIn(0, 20)
    fun slot(pool: String, level: Int, total: Int) = buildJsonObject {
        val used =
            previous[pool]
                .arrayValue()
                .firstOrNull { it.objectValue()["level"].number() == level }
                .objectValue()["used"]
                .number()
        put("level", level)
        put("total", total)
        put("used", used.coerceIn(0, total))
    }
    return buildJsonObject {
        put(
            "long_rest",
            JsonArray(
                (fullCasterSlots.getOrNull(level - 1) ?: emptyList()).mapIndexed { index, total ->
                    slot("long_rest", index + 1, total)
                }
            ),
        )
        put(
            "short_rest",
            JsonArray(
                if (pactLevel == 0) emptyList()
                else
                    listOf(
                        slot(
                            "short_rest",
                            minOf(5, (pactLevel + 1) / 2),
                            when {
                                pactLevel >= 17 -> 4
                                pactLevel >= 11 -> 3
                                pactLevel >= 2 -> 2
                                else -> 1
                            },
                        )
                    )
            ),
        )
    }
}

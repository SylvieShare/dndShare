package ru.dndshare.client.maps

import kotlin.math.*
import kotlinx.serialization.json.*

data class MapNearbyPlacement(val tile: JsonObject, val elevation: Double)

fun nearestMapTilePlacement(
    document: JsonObject,
    tile: JsonObject,
    models: Map<String, MapModel>,
    ignored: Set<String> = emptySet(),
    radius: Int = 2,
    group: List<JsonObject>? = null,
    origin: JsonObject = tile,
): MapNearbyPlacement? {
    val base =
        document.with(
            "tiles",
            JsonArray(document.rows("tiles").filter { it.string("id") !in ignored }),
        )
    if (base.rows("tiles").size + (group?.size ?: 1) > 4096) return null
    val context = MapStructureContext(base, models)
    var best: MapNearbyPlacement? = null
    var distance = Double.POSITIVE_INFINITY
    var preference = Int.MAX_VALUE
    for (dy in -radius..radius) for (dx in -radius..radius) {
        val next =
            tile
                .with("x", JsonPrimitive(tile.number("x").roundToInt() + dx))
                .with("y", JsonPrimitive(tile.number("y").roundToInt() + dy))
        val elevation =
            runCatching {
                if (group == null) context.check(next).elevation
                else {
                    val targets = group.map { row ->
                        row.with(
                                "x",
                                JsonPrimitive(
                                    (row.number("x") + next.number("x") - origin.number("x"))
                                        .roundToInt()
                                ),
                            )
                            .with(
                                "y",
                                JsonPrimitive(
                                    (row.number("y") + next.number("y") - origin.number("y"))
                                        .roundToInt()
                                ),
                            )
                            .with(
                                "level",
                                JsonPrimitive(
                                    (row.number("level") + next.number("level") -
                                            origin.number("level"))
                                        .toInt()
                                ),
                            )
                    }
                    context.checkGroup(targets)[tile.string("id")]?.elevation ?: 0.0
                }
            }
                .getOrNull() ?: continue
        val d =
            (next.number("x") - tile.number("x")).pow(2) +
                (next.number("y") - tile.number("y")).pow(2)
        val priority = abs(dx) + abs(dy)
        if (d < distance - 1e-9 || abs(d - distance) < 1e-9 && priority < preference) {
            best = MapNearbyPlacement(next, elevation)
            distance = d
            preference = priority
        }
    }
    return best
}

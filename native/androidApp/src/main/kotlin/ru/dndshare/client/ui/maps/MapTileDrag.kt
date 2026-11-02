package ru.dndshare.client.ui.maps

import androidx.compose.runtime.*
import kotlin.math.roundToInt
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*

/** A preview never replaces the document; release edits positions in the newest snapshot. */
internal class MapTileDrag {
    var preview by mutableStateOf<JsonObject?>(null)
        private set

    private var origin: MapPose? = null
    private var positions = emptyMap<String, Pair<Int, Int>>()

    fun cancel() {
        preview = null
        origin = null
        positions = emptyMap()
    }

    fun move(
        document: JsonObject,
        models: Map<String, MapModel>,
        hit: String,
        point: MapPose,
        end: Boolean,
        selected: Set<String>,
        select: (Set<String>) -> Unit,
        commit: ((JsonObject) -> JsonObject) -> Unit,
    ) {
        if (origin == null) {
            if (document.rows("tiles").none { it.string("id") == hit }) return
            val group = if (hit in selected) selected else setOf(hit)
            val ids = runCatching {
                mapDependentTiles(document, models, group)
            }
                .getOrElse {
                    return
                }
            positions =
                document
                    .rows("tiles")
                    .filter { it.string("id") in ids }
                    .associate {
                        it.string("id") to (it.number("x").toInt() to it.number("y").toInt())
                    }
            origin = point
            select(group)
        }
        val from = requireNotNull(origin)
        val dx = (point.x - from.x).roundToInt()
        val dy = (point.y - from.y).roundToInt()
        val targets = positions.mapValues { (_, xy) -> xy.first + dx to xy.second + dy }
        fun apply(current: JsonObject): JsonObject =
            current.with(
                "tiles",
                JsonArray(
                    current.rows("tiles").map { tile ->
                        targets[tile.string("id")]?.let { (x, y) ->
                            tile.with("x", JsonPrimitive(x)).with("y", JsonPrimitive(y))
                        } ?: tile
                    }
                ),
            )
        val next = apply(document)
        val valid = runCatching { mapPlacements(next, models) }.isSuccess
        if (valid) preview = next
        if (end) {
            if (valid) commit(::apply)
            cancel()
        }
    }
}

package ru.dndshare.client.maps

import kotlin.math.*
import kotlinx.serialization.json.*

fun resizeMap(
    document: JsonObject,
    catalogue: Collection<MapModel>,
    width: Int,
    height: Int,
): JsonObject {
    require(width in 2..160 && height in 2..160 && width * height <= 16000) {
        "Размер карты: 2–160 клеток по стороне, не более 16000 клеток"
    }
    val models = catalogue.associateBy { it.uuid }
    val removed =
        document
            .rows("tiles")
            .filter { tile ->
                val size = mapFootprint(tile, requireNotNull(models[tile.string("modelId")]))
                tile.number("x") + size.first > width || tile.number("y") + size.second > height
            }
            .map { it.string("id") }
            .toSet()
    var next =
        mapRemove(document, models, removed.map { MapEntityRef(MapEntityKind.Tile, it) }.toSet())
            .with("width", JsonPrimitive(width))
            .with("height", JsonPrimitive(height))
    next =
        next.with(
            "objects",
            JsonArray(
                next.rows("objects").filter {
                    it.number("x") >= 0 &&
                        it.number("y") >= 0 &&
                        it.number("x") < width &&
                        it.number("y") < height
                }
            ),
        )
    val oldWidth = ceil(document.number("width")).toInt()
    next =
        next.with(
            "zones",
            JsonArray(
                document.rows("zones").map { zone ->
                    val cells =
                        zone
                            .array("cells")
                            .map { it.jsonPrimitive.int }
                            .filter { it % oldWidth < width && it / oldWidth < height }
                            .map { JsonPrimitive((it / oldWidth) * width + it % oldWidth) }
                    val rects =
                        zone
                            .rows("rects")
                            .filter { it.number("x") < width && it.number("y") < height }
                            .map { rect ->
                                rect
                                    .with(
                                        "width",
                                        JsonPrimitive(
                                            min(rect.number("width"), width - rect.number("x"))
                                        ),
                                    )
                                    .with(
                                        "height",
                                        JsonPrimitive(
                                            min(rect.number("height"), height - rect.number("y"))
                                        ),
                                    )
                            }
                    zone.with("cells", JsonArray(cells)).with("rects", JsonArray(rects))
                }
            ),
        )
    return normalizeMapDocument(next, catalogue)
}

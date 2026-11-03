package ru.dndshare.client.maps

import kotlin.math.hypot
import kotlin.math.roundToInt
import kotlinx.serialization.json.*

fun mapGroupPivot(
    tiles: List<JsonObject>,
    objects: List<JsonObject>,
    models: Map<String, MapModel>,
): MapPose {
    val bounds =
        tiles.map { row ->
            val size = mapFootprint(row, models.getValue(row.string("modelId")))
            doubleArrayOf(
                row.number("x"),
                row.number("y"),
                row.number("x") + size.first,
                row.number("y") + size.second,
            )
        } +
            objects.map {
                doubleArrayOf(it.number("x"), it.number("y"), it.number("x"), it.number("y"))
            }
    require(bounds.isNotEmpty())
    val x = (bounds.minOf { it[0] } + bounds.maxOf { it[2] }) / 2
    val y = (bounds.minOf { it[1] } + bounds.maxOf { it[3] }) / 2
    if (tiles.isEmpty()) return MapPose(x, y)
    return listOf(0.0, .5)
        .map { offset ->
            MapPose((x - offset).roundToInt() + offset, (y - offset).roundToInt() + offset)
        }
        .minBy { hypot(it.x - x, it.y - y) }
}

fun mapRotateGroup(
    tiles: List<JsonObject>,
    objects: List<JsonObject>,
    models: Map<String, MapModel>,
    pivot: MapPose = mapGroupPivot(tiles, objects, models),
): Pair<List<JsonObject>, List<JsonObject>> {
    fun turn(x: Double, y: Double) = pivot.x - (y - pivot.y) to pivot.y + (x - pivot.x)
    val turned = tiles.map { row ->
        val size = mapFootprint(row, models.getValue(row.string("modelId")))
        val center = turn(row.number("x") + size.first / 2.0, row.number("y") + size.second / 2.0)
        row.with("x", JsonPrimitive((center.first - size.second / 2.0).roundToInt()))
            .with("y", JsonPrimitive((center.second - size.first / 2.0).roundToInt()))
            .with("rotation", JsonPrimitive((row.number("rotation").toInt() + 90) % 360))
    }
    val moved = objects.map { row ->
        val point = turn(row.number("x"), row.number("y"))
        row.with("x", JsonPrimitive(point.first))
            .with("y", JsonPrimitive(point.second))
            .with("rotation", JsonPrimitive((row.number("rotation") + 90) % 360))
    }
    return turned to moved
}

fun mapMirrorGroup(tiles: List<JsonObject>, models: Map<String, MapModel>): List<JsonObject> {
    if (tiles.isEmpty()) return tiles
    val axis =
        tiles.minOf { it.number("x") } +
            tiles.maxOf {
                it.number("x") + mapFootprint(it, models.getValue(it.string("modelId"))).first
            }
    return tiles.map { row ->
        row.with(
                "x",
                JsonPrimitive(
                    (axis -
                            row.number("x") -
                            mapFootprint(row, models.getValue(row.string("modelId"))).first)
                        .roundToInt()
                ),
            )
            .with("rotation", JsonPrimitive((360 - row.number("rotation").toInt()) % 360))
            .with("mirrored", JsonPrimitive(!row.flag("mirrored")))
    }
}

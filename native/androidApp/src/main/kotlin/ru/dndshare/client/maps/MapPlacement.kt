package ru.dndshare.client.maps

import kotlin.math.abs
import kotlin.math.max
import kotlinx.serialization.json.*

@kotlinx.serialization.Serializable
data class MapPose(val x: Double, val y: Double, val elevation: Double = 0.0)

data class MapSupport(val elevation: Double, val parents: Set<String>)

private data class Socket(
    val elevation: Double,
    val rise: Double,
    val rises: JsonObject?,
    val parent: String,
)

fun mapFootprint(tile: JsonObject, model: MapModel): Pair<Int, Int> =
    if (tile.number("rotation").toInt() % 180 != 0) model.height to model.width
    else model.width to model.height

/** Port of battlemap.ResolveTilePlacements: one highest socket can support an overhang. */
fun mapPlacements(document: JsonObject, models: Map<String, MapModel>): Map<String, MapSupport> {
    val result = mutableMapOf<String, MapSupport>()
    val occupied = mutableSetOf<Triple<Int, Int, Int>>()
    val sockets = mutableMapOf<Triple<Int, Int, Int>, Socket>()
    val tiles = document.rows("tiles").sortedBy { it.number("level") }
    require(tiles.size <= 4096) { "На карте может быть до 4096 плиток" }
    for (tile in tiles) {
        val model =
            requireNotNull(models[tile.string("modelId")]) {
                "Модель плитки отсутствует в каталоге"
            }
        require(!model.isObject) { "Объект не является плиткой" }
        val (width, height) = mapFootprint(tile, model)
        val x = tile.number("x").toInt()
        val y = tile.number("y").toInt()
        val level = tile.number("level").toInt()
        val rotation = tile.number("rotation").toInt()
        require(level in 0..15 && rotation in listOf(0, 90, 180, 270)) {
            "Некорректный уровень или поворот"
        }
        require(
            x >= 0 &&
                y >= 0 &&
                x + width <= document.number("width") &&
                y + height <= document.number("height")
        ) {
            "Плитка выходит за границу карты"
        }
        val supports = mutableListOf<Socket>()
        for (cy in y until y + height) for (cx in x until x + width) {
            val key = Triple(cx, cy, level)
            require(occupied.add(key)) { "Плитки на одном уровне не должны перекрываться" }
            if (level > 0)
                sockets[key]?.let { socket ->
                    val rise =
                        if (model.mountDepth > 0)
                            socket.rises?.number(model.mountProfile, socket.rise) ?: socket.rise
                        else 0.0
                    supports += socket.copy(elevation = socket.elevation + rise)
                }
        }
        require(level == 0 || supports.isNotEmpty()) { "Для верхнего уровня нужен опорный слот" }
        val elevation = max(0.0, supports.maxOfOrNull { it.elevation } ?: 0.0)
        result[tile.string("id")] =
            MapSupport(
                elevation,
                supports.filter { abs(it.elevation - elevation) <= .015 }.map { it.parent }.toSet(),
            )
        for (value in model.supportSlots) {
            val slot = value.jsonObject
            var sx = slot.number("x").toInt()
            var sy = slot.number("y").toInt()
            var sw = slot.number("width").toInt()
            var sh = slot.number("height").toInt()
            if (tile.flag("mirrored")) sx = model.width - sx - sw
            when (rotation) {
                90 -> {
                    val t = sx
                    sx = model.height - sy - sh
                    sy = t
                    val w = sw
                    sw = sh
                    sh = w
                }
                180 -> {
                    sx = model.width - sx - sw
                    sy = model.height - sy - sh
                }
                270 -> {
                    val t = sx
                    sx = sy
                    sy = model.width - t - sw
                    val w = sw
                    sw = sh
                    sh = w
                }
            }
            for (cy in sy until sy + sh) for (cx in sx until sx + sw) sockets[
                Triple(x + cx, y + cy, level + 1)] =
                Socket(
                    elevation + slot.number("elevation") - model.mountDepth,
                    slot.number("insertionRise"),
                    slot["insertionRises"] as? JsonObject,
                    tile.string("id"),
                )
        }
    }
    return result
}

fun mapSurface(tile: JsonObject, model: MapModel, point: JsonObject, elevation: Double): MapPose {
    var x = point.number("x")
    var y = point.number("y")
    if (tile.flag("mirrored")) x = model.width - x
    when (tile.number("rotation").toInt()) {
        90 -> {
            val old = x
            x = model.height - y
            y = old
        }
        180 -> {
            x = model.width - x
            y = model.height - y
        }
        270 -> {
            val old = x
            x = y
            y = model.width - old
        }
    }
    return MapPose(
        tile.number("x") + x,
        tile.number("y") + y,
        elevation + point.number("elevation") - model.mountDepth,
    )
}

fun mapDependentTiles(
    document: JsonObject,
    models: Map<String, MapModel>,
    selected: Set<String>,
): Set<String> {
    val placements = mapPlacements(document, models)
    val removed = selected.toMutableSet()
    do {
        val count = removed.size
        placements.forEach { (id, pose) -> if (pose.parents.any { it in removed }) removed += id }
    } while (count != removed.size)
    return removed
}

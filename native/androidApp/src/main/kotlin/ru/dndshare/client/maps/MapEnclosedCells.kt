package ru.dndshare.client.maps

import kotlin.math.floor
import kotlinx.serialization.json.*

/** Flood fill succeeds only for an empty region fully bounded by occupied cells. */
fun mapEnclosedCells(
    document: JsonObject,
    point: MapPose,
    models: Map<String, MapModel>,
    level: Int = 0,
): List<Pair<Int, Int>>? {
    val width = document.number("width").toInt()
    val height = document.number("height").toInt()
    val x = floor(point.x).toInt()
    val y = floor(point.y).toInt()
    if (x !in 0 until width || y !in 0 until height) return null
    val occupied = HashSet<Int>()
    val rows = document.rows("tiles").filter { it.number("level").toInt() == level }
    for (tile in rows) {
        val model = models[tile.string("modelId")] ?: return null
        val (w, h) = mapFootprint(tile, model)
        for (dy in 0 until h) for (dx in 0 until w) occupied +=
            (tile.number("y").toInt() + dy) * width + tile.number("x").toInt() + dx
    }
    val start = y * width + x
    if (start in occupied) return null
    val seen = hashSetOf(start)
    val queue = mutableListOf(start)
    var index = 0
    while (index < queue.size) {
        val cell = queue[index++]
        val cx = cell % width
        val cy = cell / width
        if (cx == 0 || cy == 0 || cx == width - 1 || cy == height - 1) return null
        for (next in listOf(cell - 1, cell + 1, cell - width, cell + width)) if (
            next !in occupied && seen.add(next)
        )
            queue += next
        if (queue.size + rows.size > 4096) return null
    }
    return queue.sorted().map { it % width to it / width }
}

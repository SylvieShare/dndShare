package ru.dndshare.client.maps

import kotlin.math.abs
import kotlin.math.max
import kotlinx.serialization.json.*

/** One immutable spatial index is shared by support queries and nearby placement candidates. */
data class MapStructureCell(val x: Int, val y: Int, val level: Int)

data class MapStructureSocket(
    val elevation: Double,
    val rise: Double,
    val rises: JsonObject?,
    val parent: String,
)

class MapStructureContext(val document: JsonObject, val models: Map<String, MapModel>) {
    private val occupied = mutableMapOf<MapStructureCell, String>()
    private val supportCells = mutableMapOf<MapStructureCell, MapStructureSocket>()
    val sockets: Map<MapStructureCell, MapStructureSocket>
        get() = supportCells

    private val poses = mutableMapOf<String, MapSupport>()
    val placements: Map<String, MapSupport>
        get() = poses

    private val count = document.rows("tiles").size

    init {
        require(count <= 4096) { "На карте может быть до 4096 плиток" }
        for (tile in document.rows("tiles").sortedBy { it.number("level") }) register(
            tile,
            occupied,
            supportCells,
            poses,
        )
    }

    fun check(tile: JsonObject, ignore: String? = null): MapSupport =
        check(tile, ignore, occupied, supportCells)

    fun checkGroup(rows: List<JsonObject>): Map<String, MapSupport> {
        require(count + rows.size <= 4096) { "На карте может быть до 4096 плиток" }
        val cells = occupied.toMutableMap()
        val supports = supportCells.toMutableMap()
        val poses = this.poses.toMutableMap()
        for (tile in rows.sortedBy { it.number("level") }) register(tile, cells, supports, poses)
        return poses
    }

    private fun check(
        tile: JsonObject,
        ignore: String?,
        cells: Map<MapStructureCell, String>,
        supports: Map<MapStructureCell, MapStructureSocket>,
    ): MapSupport {
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
        val found = mutableListOf<MapStructureSocket>()
        for (cy in y until y + height) for (cx in x until x + width) {
            val key = MapStructureCell(cx, cy, level)
            require(cells[key] == null || cells[key] == ignore) {
                "Плитки на одном уровне не должны перекрываться"
            }
            if (level > 0)
                supports[key]?.let { slot ->
                    val rise =
                        if (model.mountDepth > 0)
                            slot.rises?.number(model.mountProfile, slot.rise) ?: slot.rise
                        else 0.0
                    found += slot.copy(elevation = slot.elevation + rise)
                }
        }
        require(level == 0 || found.isNotEmpty()) { "Для верхнего уровня нужен опорный слот" }
        val elevation = max(0.0, found.maxOfOrNull { it.elevation } ?: 0.0)
        return MapSupport(
            elevation,
            found.filter { abs(it.elevation - elevation) <= .015 }.map { it.parent }.toSet(),
        )
    }

    private fun register(
        tile: JsonObject,
        cells: MutableMap<MapStructureCell, String>,
        supports: MutableMap<MapStructureCell, MapStructureSocket>,
        poses: MutableMap<String, MapSupport>,
    ) {
        val pose = check(tile, null, cells, supports)
        val id = tile.string("id")
        poses[id] = pose
        val model = models.getValue(tile.string("modelId"))
        val (width, height) = mapFootprint(tile, model)
        val x = tile.number("x").toInt()
        val y = tile.number("y").toInt()
        val level = tile.number("level").toInt()
        for (cy in y until y + height) for (cx in x until x + width) cells[
            MapStructureCell(cx, cy, level)] = id
        for (raw in model.supportSlots) {
            val slot =
                mapRotatedSupportSlot(
                    raw.jsonObject,
                    model,
                    tile.number("rotation").toInt(),
                    tile.flag("mirrored"),
                )
            for (cy in
                slot.number("y").toInt() until
                    (slot.number("y") + slot.number("height")).toInt()) for (cx in
                slot.number("x").toInt() until
                    (slot.number("x") + slot.number("width")).toInt()) supports[
                MapStructureCell(x + cx, y + cy, level + 1)] =
                MapStructureSocket(
                    pose.elevation + slot.number("elevation") - model.mountDepth,
                    slot.number("insertionRise"),
                    slot["insertionRises"] as? JsonObject,
                    id,
                )
        }
    }
}

fun mapRotatedSupportSlot(
    raw: JsonObject,
    model: MapModel,
    rotation: Int,
    mirrored: Boolean = false,
): JsonObject {
    var x = raw.number("x").toInt()
    var y = raw.number("y").toInt()
    var width = raw.number("width").toInt()
    var height = raw.number("height").toInt()
    if (mirrored) x = model.width - x - width
    when (rotation) {
        90 -> {
            val old = x
            x = model.height - y - height
            y = old
            val w = width
            width = height
            height = w
        }
        180 -> {
            x = model.width - x - width
            y = model.height - y - height
        }
        270 -> {
            val old = x
            x = y
            y = model.width - old - width
            val w = width
            width = height
            height = w
        }
    }
    return raw.with("x", JsonPrimitive(x))
        .with("y", JsonPrimitive(y))
        .with("width", JsonPrimitive(width))
        .with("height", JsonPrimitive(height))
}

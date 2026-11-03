package ru.dndshare.client.maps

import kotlin.math.*
import kotlinx.serialization.json.*

internal data class MapGuideField(
    val key: String,
    val label: String,
    val caption: String,
    val colour: String,
)

internal val mapGuideFields =
    listOf(
        MapGuideField("mountDepth", "Глубина монтажного основания", "Основание", "#dfb878"),
        MapGuideField("surfaceHeight", "Высота поверхности", "Поверхность", "#81d7e5"),
        MapGuideField("maxHeight", "Полная высота модели", "Верх модели", "#b8a1f2"),
        MapGuideField("offsetX", "Смещение модели X", "Сдвиг X", "#eea09b"),
        MapGuideField("offsetZ", "Смещение модели Z", "Сдвиг Z", "#97b8ee"),
    )

internal data class MapGuideLine(
    val a: MapPose,
    val b: MapPose,
    val colour: String,
    val opacity: Float = 1f,
)

internal data class MapGuideLabel(val field: MapGuideField, val value: Double, val point: MapPose)

internal data class MapGuideMarker(
    val kind: String,
    val index: Int,
    val point: MapPose,
    val active: Boolean = true,
    val valid: Boolean = true,
)

internal data class MapModelGuides(
    val lines: List<MapGuideLine>,
    val labels: List<MapGuideLabel>,
    val markers: List<MapGuideMarker>,
)

/** Coordinates and colours mirror modelPreviewGeometry/modelPreviewGuides in the web editor. */
internal fun mapModelGuides(
    model: MapModel,
    activeField: String?,
    selectedSlot: Int,
): MapModelGuides {
    val w = model.width.toDouble()
    val h = model.height.toDouble()
    val mount = model.mountDepth
    val bottom = -mount
    val surface = model.surfaceHeight - mount
    val top = model.maxHeight - mount
    val ox = model.placementOffset.getOrElse(0) { 0.0 }
    val oz = model.placementOffset.getOrElse(1) { 0.0 }
    val lines = mutableListOf<MapGuideLine>()
    val labels = mutableListOf<MapGuideLabel>()
    val markers = mutableListOf<MapGuideMarker>()
    fun p(x: Double, z: Double, y: Double) = MapPose(x + 1, z + 1, y)
    fun line(a: MapPose, b: MapPose, colour: String, alpha: Float = 1f) {
        lines += MapGuideLine(a, b, colour, alpha)
    }
    fun rect(
        x: Double,
        z: Double,
        width: Double,
        height: Double,
        y: Double,
        colour: String,
        alpha: Float = 1f,
    ) {
        val points =
            listOf(p(x, z, y), p(x + width, z, y), p(x + width, z + height, y), p(x, z + height, y))
        points.forEachIndexed { i, a -> line(a, points[(i + 1) % 4], colour, alpha) }
    }
    for (x in 0..model.width) line(
        p(x.toDouble(), 0.0, 0.0),
        p(x.toDouble(), h, 0.0),
        "#66707d",
        .45f,
    )
    for (z in 0..model.height) line(
        p(0.0, z.toDouble(), 0.0),
        p(w, z.toDouble(), 0.0),
        "#66707d",
        .45f,
    )
    rect(0.0, 0.0, w, h, 0.0, "#a9bacd")
    val radius = model.raw.number("referenceDiameter") / 2
    if (radius > 0)
        repeat(64) { i ->
            fun at(n: Int) =
                p(
                    w / 2 + ox + cos(n * PI / 32) * radius,
                    h / 2 + oz + sin(n * PI / 32) * radius,
                    .012,
                )
            line(at(i), at(i + 1), "#78d4e7")
        }
    for ((i, field) in mapGuideFields.withIndex()) {
        val active = activeField == null || activeField == field.key
        val alpha = if (active) 1f else .3f
        val a: MapPose
        val b: MapPose
        val value: Double
        if (i < 3) {
            val high = listOf(0.0, surface, top)[i]
            val x = w + .22 + i * .24
            a = p(x, h / 2, bottom)
            b = p(x, h / 2, high)
            rect(
                0.0,
                0.0,
                w,
                h,
                if (i == 0) bottom else high,
                field.colour,
                if (active) .8f else .2f,
            )
            for (y in listOf(bottom, high)) line(
                p(x - .08, h / 2, y),
                p(x + .08, h / 2, y),
                field.colour,
                alpha,
            )
            value = listOf(mount, model.surfaceHeight, model.maxHeight)[i]
        } else {
            val z = h + .28 + (i - 3) * .25
            a = p(w / 2, z, 0.0)
            b = p(w / 2 + (if (i == 3) ox else 0.0), z + (if (i == 4) oz else 0.0), 0.0)
            line(p(w / 2, h / 2, .012), p(w / 2 + ox, h / 2 + oz, .012), field.colour, alpha)
            value = if (i == 3) ox else oz
        }
        line(a, b, field.colour, alpha)
        labels +=
            MapGuideLabel(
                field,
                value,
                MapPose((a.x + b.x) / 2, (a.y + b.y) / 2, (a.elevation + b.elevation) / 2),
            )
    }
    val directions = listOf(0 to -1, 1 to -1, 1 to 0, 1 to 1, 0 to 1, -1 to 1, -1 to 0, -1 to -1)
    val mode = model.raw.string("wallMode", "none")
    val mask = model.raw.number("wallMask").toInt()
    if (mode != "none")
        for ((index, direction) in directions.withIndex()) if (mode != "edge" || index % 2 == 0)
            markers +=
                MapGuideMarker(
                    "port",
                    index,
                    p(
                        w / 2 + direction.first * w / 2,
                        h / 2 + direction.second * h / 2,
                        max(0.0, top) + .24,
                    ),
                    mask and (1 shl index) != 0,
                )
    for ((index, value) in model.supportSlots.withIndex()) {
        val slot = value.jsonObject
        val sw = slot.number("width").toInt().coerceIn(1, 8)
        val sh = slot.number("height").toInt().coerceIn(1, 8)
        val rises = slot["insertionRises"] as? JsonObject ?: JsonObject(emptyMap())
        val profile = Regex("[a-z][a-z0-9-]{0,63}")
        val valid =
            (model.mountProfile.isBlank() || (mount > 0 && model.mountProfile.matches(profile))) &&
                slot.number("x") >= 0 &&
                slot.number("y") >= 0 &&
                slot.number("width") >= 1 &&
                slot.number("height") >= 1 &&
                slot.number("x") + slot.number("width") <= w &&
                slot.number("y") + slot.number("height") <= h &&
                slot.number("elevation") > mount &&
                slot.number("elevation") <= model.maxHeight + .001 &&
                slot.number("insertionRise") in 0.0..0.15 &&
                (slot.number("insertionRise") == 0.0 || model.tileType == "frame") &&
                rises.size <= 16 &&
                rises.all { (key, v) ->
                    model.tileType == "frame" &&
                        key.matches(profile) &&
                        ((v as? JsonPrimitive)?.doubleOrNull ?: Double.NaN) in 0.0..0.15
                }
        for (y in 0 until sh) for (x in 0 until sw) markers +=
            MapGuideMarker(
                "slot",
                index,
                p(
                    slot.number("x") + x + .5,
                    slot.number("y") + y + .5,
                    slot.number("elevation") - mount + .035,
                ),
                valid = valid,
            )
        if (index == selectedSlot)
            rect(
                slot.number("x"),
                slot.number("y"),
                sw.toDouble(),
                sh.toDouble(),
                slot.number("elevation") - mount + .025,
                if (valid) "#d9b3ff" else "#ec7777",
            )
    }
    for ((index, value) in model.placementPoints.withIndex()) {
        val point = value.jsonObject
        markers +=
            MapGuideMarker(
                "point",
                index,
                p(point.number("x"), point.number("y"), point.number("elevation") - mount + .035),
                active = model.canStand,
            )
    }
    return MapModelGuides(lines, labels, markers)
}

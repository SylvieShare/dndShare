package ru.dndshare.client.maps

import java.util.UUID
import kotlin.math.*
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.rendering.MapCamera

fun captureMapCamera(camera: MapCamera, width: Int, height: Int): JsonObject {
    camera.saved?.let {
        return it
    }
    val delta =
        camera.eye.let {
            doubleArrayOf(it[0] - camera.x, it[2] - camera.y, it[1] - camera.elevation)
        }
    val frameWidth = width / camera.pixels
    val distance = (frameWidth / 4).coerceIn(1.0, 6.0)
    val length = sqrt(delta.sumOf { it * it })
    return buildJsonObject {
        put(
            "position",
            numbers(
                camera.x + delta[0] * distance / length,
                camera.y + delta[1] * distance / length,
                camera.elevation + delta[2] * distance / length,
            ),
        )
        put("target", numbers(camera.x, camera.y, camera.elevation))
        put(
            "up",
            numbers(
                -sin(Math.toRadians(camera.azimuth)),
                -cos(Math.toRadians(camera.azimuth)),
                0.0,
            ),
        )
        put("width", frameWidth)
        put("aspect", (width.toDouble() / height.coerceAtLeast(1)).coerceIn(.25, 4.0))
    }
}

fun newMapCamera(document: JsonObject, view: JsonObject): JsonObject {
    require(document.rows("cameras").size < 64) { "Не более 64 камер на карте" }
    return document.with(
        "cameras",
        JsonArray(
            document.rows("cameras") +
                buildJsonObject {
                    put("id", UUID.randomUUID().toString())
                    put("name", "Камера ${document.rows("cameras").size+1}")
                    put("view", view)
                }
        ),
    )
}

fun mapCameraView(view: JsonObject, viewportWidth: Int): MapCamera {
    val position = view.array("position")
    val target = view.array("target")
    val dx = position.double(0) - target.double(0)
    val dy = position.double(1) - target.double(1)
    val dz = position.double(2) - target.double(2)
    return MapCamera(
        target.double(0),
        target.double(1),
        viewportWidth / view.number("width", 1.0),
        Math.toDegrees(atan2(dz, hypot(dx, dy))),
        Math.toDegrees(
            if (hypot(dx, dy) > 1e-8) atan2(dx, dy)
            else atan2(-view.array("up").double(0), -view.array("up").double(1))
        ),
        target.double(2),
        saved = view,
    )
}

fun updateMapCamera(document: JsonObject, id: String, field: String, value: Double): JsonObject {
    val camera = requireNotNull(document.rows("cameras").find { it.string("id") == id })
    val original = camera.getValue("view").jsonObject
    var view = original
    when (field) {
        "height" -> {
            val p = view.array("position").toMutableList()
            p[2] = JsonPrimitive(value)
            view = view.with("position", JsonArray(p))
        }
        "width" -> {
            require(value in .25..2000.0)
            view = view.with("width", JsonPrimitive(value))
        }
        else -> error("Неверное поле камеры")
    }
    return mapReplace(document, "cameras", camera.with("view", adjustMapCameraView(original, view)))
}

fun translateMapCamera(
    camera: JsonObject,
    origin: MapPose,
    point: MapPose,
    part: String = "body",
): JsonObject {
    val original = camera.getValue("view").jsonObject
    val dx = point.x - origin.x
    val dy = point.y - origin.y
    var view = original
    for (key in if (part == "target") listOf("target") else listOf("position", "target")) {
        val vector = original.array(key)
        view =
            view.with(key, numbers(vector.double(0) + dx, vector.double(1) + dy, vector.double(2)))
    }
    return camera.with("view", adjustMapCameraView(original, view))
}

private fun adjustMapCameraView(original: JsonObject, next: JsonObject): JsonObject {
    val direction =
        DoubleArray(3) { next.array("target").double(it) - next.array("position").double(it) }
    require(sqrt(direction.sumOf { it * it }) > .01) { "Камера не может совпадать с целью" }
    val same =
        direction.indices.all {
            abs(
                direction[it] - original.array("target").double(it) +
                    original.array("position").double(it)
            ) < 1e-8
        }
    return if (same) next
    else
        next.with(
            "up",
            if (hypot(direction[0], direction[1]) < .01) numbers(0.0, -1.0, 0.0)
            else numbers(0.0, 0.0, 1.0),
        )
}

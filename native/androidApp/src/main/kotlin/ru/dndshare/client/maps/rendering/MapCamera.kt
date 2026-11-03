package ru.dndshare.client.maps.rendering

import kotlin.math.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.MapPose

/** World coordinates are x / elevation / y, just like the shared GLB assets. */
@Serializable
data class MapCamera(
    val x: Double = 15.0,
    val y: Double = 11.0,
    val pixels: Double = 48.0,
    val tilt: Double = 35.264389682754654,
    val azimuth: Double = 45.0,
    val elevation: Double = .44,
    val saved: JsonObject? = null,
) {
    private val yaw
        get() = Math.toRadians(azimuth)

    private val pitch
        get() = Math.toRadians(tilt)

    val up: DoubleArray
        get() =
            saved?.array("up")?.let { doubleArrayOf(it.double(0), it.double(2), it.double(1)) }
                ?: doubleArrayOf(-sin(yaw), 0.0, -cos(yaw)).let { up ->
                    if (tilt < 0 && abs(cos(pitch)) > 1e-8) up.map { -it }.toDoubleArray() else up
                }

    val eye: DoubleArray
        get() {
            saved?.let { view ->
                val p = view.array("position")
                val t = view.array("target")
                val delta = DoubleArray(3) { p.double(it) - t.double(it) }
                val length = sqrt(delta.sumOf { it * it }).coerceAtLeast(.00001)
                return doubleArrayOf(
                    x + delta[0] / length * 500,
                    elevation + delta[2] / length * 500,
                    y + delta[1] / length * 500,
                )
            }
            return doubleArrayOf(
                x + sin(yaw) * cos(pitch) * 500,
                elevation + sin(pitch) * 500,
                y + cos(yaw) * cos(pitch) * 500,
            )
        }

    fun project(pose: MapPose, width: Int, height: Int): Pair<Float, Float> {
        saved?.let {
            return mapSavedProject(this, it, pose, width, height)
        }
        val dx = pose.x - x
        val dy = pose.y - y
        return (width / 2 + pixels * (cos(yaw) * dx - sin(yaw) * dy)).toFloat() to
            (height / 2 +
                    pixels *
                        (sin(pitch) * (sin(yaw) * dx + cos(yaw) * dy) -
                            cos(pitch) * (pose.elevation - elevation)))
                .toFloat()
    }

    fun world(px: Double, py: Double, width: Int, height: Int, elevation: Double = .44): MapPose {
        saved?.let {
            return mapSavedWorld(this, it, px, py, width, height, elevation)
        }
        if (abs(sin(pitch)) < 1e-8) return MapPose(-1.0, -1.0, elevation)
        val horizontal = (px - width / 2.0) / pixels
        val vertical =
            ((py - height / 2.0) / pixels + cos(pitch) * (elevation - this.elevation)) / sin(pitch)
        return MapPose(
            x + cos(yaw) * horizontal + sin(yaw) * vertical,
            y - sin(yaw) * horizontal + cos(yaw) * vertical,
            elevation,
        )
    }

    fun pan(dx: Double, dy: Double): MapCamera {
        if (saved != null) return copy(saved = null).pan(dx, dy)
        val a = world(0.0, 0.0, 0, 0)
        val b = world(dx, dy, 0, 0)
        return copy(x = x + a.x - b.x, y = y + a.y - b.y)
    }

    fun zoom(factor: Double, px: Double, py: Double, width: Int, height: Int): MapCamera {
        if (saved != null) return copy(saved = null).zoom(factor, px, py, width, height)
        val a = world(px, py, width, height)
        val next = copy(pixels = (pixels * factor).coerceIn(.5, 400.0))
        val b = next.world(px, py, width, height)
        return next.copy(x = next.x + a.x - b.x, y = next.y + a.y - b.y)
    }

    fun fit(mapWidth: Double, mapHeight: Double, width: Int, height: Int): MapCamera {
        val c = abs(cos(yaw))
        val s = abs(sin(yaw))
        val pixels =
            min(
                (width - 60).coerceAtLeast(1) / (c * mapWidth + s * mapHeight),
                (height - 60).coerceAtLeast(1) /
                    ((s * mapWidth + c * mapHeight) * sin(pitch) + 2 * cos(pitch)),
            )
        return copy(
            x = mapWidth / 2,
            y = mapHeight / 2,
            pixels = pixels.coerceIn(.5, 400.0),
            saved = null,
        )
    }
}

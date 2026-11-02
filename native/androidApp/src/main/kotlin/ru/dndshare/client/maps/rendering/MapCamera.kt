package ru.dndshare.client.maps.rendering

import kotlin.math.*
import ru.dndshare.client.maps.MapPose

/** World coordinates are x / elevation / y, just like the shared GLB assets. */
data class MapCamera(
    val x: Double = 15.0,
    val y: Double = 11.0,
    val pixels: Double = 48.0,
    val tilt: Double = 35.264389682754654,
    val azimuth: Double = 45.0,
    val elevation: Double = .44,
) {
    private val yaw
        get() = Math.toRadians(azimuth)

    private val pitch
        get() = Math.toRadians(tilt)

    val eye: DoubleArray
        get() =
            doubleArrayOf(
                x + sin(yaw) * cos(pitch) * 500,
                elevation + sin(pitch) * 500,
                y + cos(yaw) * cos(pitch) * 500,
            )

    fun project(pose: MapPose, width: Int, height: Int): Pair<Float, Float> {
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
        val a = world(0.0, 0.0, 0, 0)
        val b = world(dx, dy, 0, 0)
        return copy(x = x + a.x - b.x, y = y + a.y - b.y)
    }

    fun zoom(factor: Double, px: Double, py: Double, width: Int, height: Int): MapCamera {
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
        return copy(x = mapWidth / 2, y = mapHeight / 2, pixels = pixels.coerceIn(.5, 400.0))
    }
}

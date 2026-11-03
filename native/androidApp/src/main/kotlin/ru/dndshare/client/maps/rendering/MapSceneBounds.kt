package ru.dndshare.client.maps.rendering

import com.google.android.filament.Box
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.*

internal fun mapFitScene(
    camera: MapCamera,
    entries: List<MapSceneEntry>,
    bounds: Map<String, Box>,
    width: Int,
    height: Int,
): MapCamera {
    if (entries.isEmpty() || width <= 0 || height <= 0) return camera
    val points = entries.flatMap { entry ->
        val bound = bounds[entry.model.renderUrl]
        val center = bound?.center ?: floatArrayOf(0f, (entry.model.maxHeight / 2).toFloat(), 0f)
        val half =
            bound?.halfExtent
                ?: floatArrayOf(
                    entry.model.width / 2f,
                    (entry.model.maxHeight / 2).toFloat(),
                    entry.model.height / 2f,
                )
        listOf(-1, 1).flatMap { x ->
            listOf(-1, 1).flatMap { y ->
                listOf(-1, 1).map { z ->
                    Mat4.point(
                        entry.matrix,
                        Vec3(
                            center[0] + half[0] * x,
                            center[1] + half[1] * y,
                            center[2] + half[2] * z,
                        ),
                    )
                }
            }
        }
    }
    val centered =
        camera.copy(
            x = (points.minOf { it.x } + points.maxOf { it.x }) / 2.0,
            y = (points.minOf { it.z } + points.maxOf { it.z }) / 2.0,
            elevation = (points.minOf { it.y } + points.maxOf { it.y }) / 2.0,
            pixels = 1.0,
        )
    val projection = points.map {
        centered.project(MapPose(it.x.toDouble(), it.z.toDouble(), it.y.toDouble()), width, height)
    }
    val spanX = (projection.maxOf { it.first } - projection.minOf { it.first }).coerceAtLeast(.1f)
    val spanY = (projection.maxOf { it.second } - projection.minOf { it.second }).coerceAtLeast(.1f)
    return centered.copy(
        pixels = minOf(width * .85 / spanX, height * .85 / spanY).coerceIn(1.0, 400.0)
    )
}

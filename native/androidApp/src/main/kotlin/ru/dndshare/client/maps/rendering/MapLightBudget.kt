package ru.dndshare.client.maps.rendering

import kotlin.math.*
import ru.dndshare.client.maps.*

const val MAP_LOCAL_LIGHT_LIMIT = 8

/** Orthographic sphere/frustum test, including a saved camera's independent aspect and roll. */
fun mapLightIntersectsView(
    pose: MapLightPose,
    camera: MapCamera,
    width: Int,
    height: Int,
): Boolean {
    if (width <= 0 || height <= 0) return false
    val radius = pose.source.number("radius", 6.0).coerceAtLeast(0.0)
    val point = pose.point.copy(elevation = pose.worldHeight)
    val screen = camera.project(point, width, height)
    val sx = camera.saved?.let { width / it.number("width", 1.0) } ?: camera.pixels
    val sy =
        camera.saved?.let { height * it.number("aspect", 1.0) / it.number("width", 1.0) }
            ?: camera.pixels
    if (
        screen.first + radius * sx < 0 ||
            screen.first - radius * sx > width ||
            screen.second + radius * sy < 0 ||
            screen.second - radius * sy > height
    )
        return false
    val eye = camera.eye
    val direction = doubleArrayOf(camera.x - eye[0], camera.elevation - eye[1], camera.y - eye[2])
    val length = sqrt(direction.sumOf { it * it })
    val depth =
        ((point.x - eye[0]) * direction[0] +
            (point.elevation - eye[1]) * direction[1] +
            (point.y - eye[2]) * direction[2]) / length
    return depth + radius >= .01 && depth - radius <= 2000
}

fun mapVisibleLights(
    sources: List<MapLightPose>,
    camera: MapCamera,
    width: Int,
    height: Int,
    selected: String? = null,
): List<MapLightPose> =
    sources
        .asSequence()
        .filter {
            it.source.flag("enabled", true) &&
                it.opacity > .001f &&
                it.source.number("intensity", 1.0) > 0 &&
                mapLightIntersectsView(it, camera, width, height)
        }
        .sortedWith(
            compareByDescending<MapLightPose> { it.source.string("id") == selected }
                .thenByDescending { it.source.flag("shadows") }
                .thenBy { hypot(it.point.x - camera.x, it.point.y - camera.y) }
        )
        .take(MAP_LOCAL_LIGHT_LIMIT)
        .toList()

package ru.dndshare.client.maps.rendering

import kotlin.math.*
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*

private fun dot(a: DoubleArray, b: DoubleArray) = a.indices.sumOf { a[it] * b[it] }

private fun cross(a: DoubleArray, b: DoubleArray) =
    doubleArrayOf(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])

private fun normal(v: DoubleArray): DoubleArray {
    val length = sqrt(dot(v, v)).coerceAtLeast(1e-10)
    return DoubleArray(3) { v[it] / length }
}

private fun basis(camera: MapCamera): Array<DoubleArray> {
    val eye = camera.eye
    val forward =
        normal(doubleArrayOf(camera.x - eye[0], camera.elevation - eye[1], camera.y - eye[2]))
    val right = normal(cross(forward, camera.up))
    val up = normal(cross(right, forward))
    return arrayOf(right, up, forward)
}

internal fun mapSavedProject(
    camera: MapCamera,
    view: JsonObject,
    point: MapPose,
    width: Int,
    height: Int,
): Pair<Float, Float> {
    val (right, up) = basis(camera)
    val delta =
        doubleArrayOf(point.x - camera.x, point.elevation - camera.elevation, point.y - camera.y)
    val span = view.number("width", 1.0)
    return (width / 2.0 + dot(delta, right) * width / span).toFloat() to
        (height / 2.0 - dot(delta, up) * height * view.number("aspect", 1.0) / span).toFloat()
}

internal fun mapSavedWorld(
    camera: MapCamera,
    view: JsonObject,
    px: Double,
    py: Double,
    width: Int,
    height: Int,
    elevation: Double,
): MapPose {
    val (right, up, direction) = basis(camera)
    if (abs(direction[1]) < 1e-8) return MapPose(-1.0, -1.0, elevation)
    val span = view.number("width", 1.0)
    val x = (px / width.coerceAtLeast(1) - .5) * span
    val y = (.5 - py / height.coerceAtLeast(1)) * span / view.number("aspect", 1.0)
    val origin = doubleArrayOf(camera.x, camera.elevation, camera.y)
    for (i in 0..2) origin[i] += right[i] * x + up[i] * y
    val distance = (elevation - origin[1]) / direction[1]
    return MapPose(
        origin[0] + direction[0] * distance,
        origin[2] + direction[2] * distance,
        elevation,
    )
}

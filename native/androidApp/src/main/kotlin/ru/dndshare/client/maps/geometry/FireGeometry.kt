package ru.dndshare.client.maps.geometry

import kotlin.math.*

/** Same three sculptural tongues as fireEffectGeometry.js; no frame textures. */
fun mapFireGeometry(): MeshGeometry {
    val points = mutableListOf<Float>()
    val triangles = mutableListOf<Int>()
    for (tongue in
        listOf(
            floatArrayOf(0f, 0f, .34f, 1f, .1f),
            floatArrayOf(-.23f, .08f, .23f, .76f, -.14f),
            floatArrayOf(.2f, -.1f, .22f, .66f, .18f),
        )) {
        val start = points.size / 3
        for (y in 0..7) {
            val t = y / 7.0
            val radius = tongue[2] * (1 - t).pow(.8) * (.72 + .5 * sin(t * PI))
            for (a in 0 until 8) {
                val angle = a / 8.0 * PI * 2
                points += (tongue[0] * (1 - t) + cos(angle) * radius + tongue[4] * t * t).toFloat()
                points += (t * tongue[3]).toFloat()
                points += (tongue[1] * (1 - t) + sin(angle) * radius).toFloat()
                if (y < 7) {
                    val i = start + y * 8 + a
                    val next = start + y * 8 + (a + 1) % 8
                    triangles.addAll(listOf(i, next, i + 8, next, next + 8, i + 8))
                }
            }
        }
    }
    val positions = points.toFloatArray()
    val normals = FloatArray(positions.size)
    fun point(i: Int) = Vec3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
    for (i in triangles.indices step 3) {
        val a = triangles[i]
        val b = triangles[i + 1]
        val c = triangles[i + 2]
        val n = (point(b) - point(a)).cross(point(c) - point(a))
        for (id in intArrayOf(a, b, c)) {
            normals[id * 3] += n.x
            normals[id * 3 + 1] += n.y
            normals[id * 3 + 2] += n.z
        }
    }
    for (i in 0 until positions.size / 3) {
        val n = Vec3(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]).normalized()
        normals[i * 3] = n.x
        normals[i * 3 + 1] = n.y
        normals[i * 3 + 2] = n.z
    }
    val count = positions.size / 3
    return MeshGeometry(
        positions,
        normals,
        FloatArray(count * 2),
        FloatArray(count * 4) { 1f },
        FloatArray(count * 2),
        triangles.toIntArray(),
    )
}

data class MapFireMotion(val offset: Vec3, val gain: Float)

fun mapFireMotion(
    id: String,
    seconds: Double,
    strength: Double,
    width: Double,
    height: Double,
): MapFireMotion {
    val phase = id.hashCode() % 1000
    val t = floor(seconds * 12) / 12
    val y = .75
    val weight = y * y * strength
    val first = sin(t * 7.3 + y * 5 + phase)
    val second = sin(t * 13.1 - y * 8 + phase)
    return MapFireMotion(
        Vec3(
            (weight * (.13 * first + .05 * second) * width).toFloat(),
            (weight * .12 * sin(t * 9.1 + phase) * height).toFloat(),
            (weight * .1 * sin(t * 8.7 + y * 6 + phase) * width).toFloat(),
        ),
        (1 + strength * (.035 * first + .025 * second)).toFloat(),
    )
}

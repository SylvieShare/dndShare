package ru.dndshare.client.maps.geometry

import kotlin.math.*

/** Clip the owner's triangles in stamp space; geometry and shared textures stay untouched. */
fun projectDecal(
    source: MeshGeometry,
    center: Vec3,
    direction: Vec3,
    width: Float,
    height: Float,
    depth: Float,
    rotation: Float,
): MeshGeometry {
    require(width > 0 && height > 0 && depth > 0)
    val normal = direction.normalized()
    val up = if (abs(normal.y) > .95f) Vec3(0f, 0f, -1f) else Vec3(0f, 1f, 0f)
    val a = up.cross(normal).normalized()
    val b = normal.cross(a).normalized()
    val angle = Math.toRadians(rotation.toDouble())
    val c = cos(angle).toFloat()
    val s = sin(angle).toFloat()
    val xAxis = a * c + b * s
    val yAxis = b * c - a * s
    fun local(p: Vec3): Vec3 {
        val d = p - center
        return Vec3(d.dot(xAxis), d.dot(yAxis), d.dot(normal))
    }
    val front =
        max(
            depth / 2,
            (0 until source.count).maxOfOrNull { local(source.position(it)).z }?.plus(.00001f)
                ?: depth / 2,
        )
    val positions = ArrayList<Float>()
    val normals = ArrayList<Float>()
    val uv = ArrayList<Float>()
    data class Vertex(val p: Vec3, val n: Vec3, val stamp: Vec3)
    fun clip(input: List<Vertex>, axis: Int, bound: Float, sign: Float): List<Vertex> {
        if (input.isEmpty()) return input
        fun distance(v: Vertex) =
            (when (axis) {
                0 -> v.stamp.x
                1 -> v.stamp.y
                else -> v.stamp.z
            } - bound) * sign
        val output = ArrayList<Vertex>()
        var previous = input.last()
        var dp = distance(previous)
        for (current in input) {
            val dc = distance(current)
            if ((dc <= 0) != (dp <= 0)) {
                val t = dp / (dp - dc)
                output +=
                    Vertex(
                        previous.p + (current.p - previous.p) * t,
                        previous.n + (current.n - previous.n) * t,
                        previous.stamp + (current.stamp - previous.stamp) * t,
                    )
            }
            if (dc <= 0) output += current
            previous = current
            dp = dc
        }
        return output
    }
    for (index in source.indices.indices step 3) {
        val ids =
            intArrayOf(source.indices[index], source.indices[index + 1], source.indices[index + 2])
        val pa = source.position(ids[0])
        val pb = source.position(ids[1])
        val pc = source.position(ids[2])
        if ((pb - pa).cross(pc - pa).normalized().dot(normal) < .15f) continue
        var polygon = ids.map {
            Vertex(source.position(it), source.normal(it), local(source.position(it)))
        }
        for ((axis, bound, sign) in
            listOf(
                Triple(0, width / 2, 1f),
                Triple(0, -width / 2, -1f),
                Triple(1, height / 2, 1f),
                Triple(1, -height / 2, -1f),
                Triple(2, front, 1f),
                Triple(2, -depth / 2, -1f),
            )) polygon = clip(polygon, axis, bound, sign)
        for (i in 1 until polygon.size - 1) for (v in
            listOf(polygon[0], polygon[i], polygon[i + 1])) {
            val p = v.p + v.n.normalized() * .0008f
            positions.addAll(listOf(p.x, p.y, p.z))
            val n = v.n.normalized()
            normals.addAll(listOf(n.x, n.y, n.z))
            uv.add(.5f + v.stamp.x / width)
            uv.add(.5f - v.stamp.y / height)
        }
    }
    val count = positions.size / 3
    return MeshGeometry(
        positions.toFloatArray(),
        normals.toFloatArray(),
        uv.toFloatArray(),
        FloatArray(count * 4) { 1f },
        FloatArray(count * 2) { if (it % 2 == 0) 1f else -1f },
        IntArray(count) { it },
    )
}

fun surfaceNormal(parts: List<GlbPart>, point: Vec3): Vec3 {
    var best = Float.POSITIVE_INFINITY
    var result = Vec3(0f, 1f, 0f)
    for (part in parts) {
        val mesh = part.geometry
        for (i in mesh.indices.indices step 3) {
            val a = mesh.position(mesh.indices[i])
            val b = mesh.position(mesh.indices[i + 1])
            val c = mesh.position(mesh.indices[i + 2])
            val edge = b - a
            val second = c - a
            val n = edge.cross(second).normalized()
            val distance = (point - a).dot(n)
            if (abs(distance) >= best) continue
            val p = point - n * distance
            val v = p - a
            val d00 = edge.dot(edge)
            val d01 = edge.dot(second)
            val d11 = second.dot(second)
            val denominator = d00 * d11 - d01 * d01
            if (abs(denominator) < 1e-12f) continue
            val u = (d11 * v.dot(edge) - d01 * v.dot(second)) / denominator
            val w = (d00 * v.dot(second) - d01 * v.dot(edge)) / denominator
            if (u >= -.002f && w >= -.002f && u + w <= 1.002f) {
                best = abs(distance)
                result = n
            }
        }
    }
    return result
}

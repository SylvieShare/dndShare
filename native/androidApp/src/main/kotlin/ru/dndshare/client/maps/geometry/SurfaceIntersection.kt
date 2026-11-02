package ru.dndshare.client.maps.geometry

import kotlin.math.abs

data class MapRayHit(val position: Vec3, val normal: Vec3, val distance: Float)

/** GPU picking identifies the owner, CPU triangles supply full-precision coordinates. */
fun mapSurfaceIntersection(parts: List<GlbPart>, origin: Vec3, direction: Vec3): MapRayHit? {
    var nearest: MapRayHit? = null
    for (part in parts) {
        val mesh = part.geometry
        for (i in mesh.indices.indices step 3) {
            val a = mesh.position(mesh.indices[i])
            val b = mesh.position(mesh.indices[i + 1])
            val c = mesh.position(mesh.indices[i + 2])
            val first = b - a
            val second = c - a
            val p = direction.cross(second)
            val determinant = first.dot(p)
            if (abs(determinant) < 1e-9f) continue
            val inverse = 1 / determinant
            val offset = origin - a
            val u = offset.dot(p) * inverse
            if (u < -.00001f || u > 1.00001f) continue
            val q = offset.cross(first)
            val v = direction.dot(q) * inverse
            if (v < -.00001f || u + v > 1.00001f) continue
            val t = second.dot(q) * inverse
            if (t >= 0 && t < (nearest?.distance ?: Float.POSITIVE_INFINITY))
                nearest = MapRayHit(origin + direction * t, first.cross(second).normalized(), t)
        }
    }
    return nearest
}

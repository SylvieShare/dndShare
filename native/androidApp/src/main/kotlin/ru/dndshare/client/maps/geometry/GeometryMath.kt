package ru.dndshare.client.maps.geometry

import kotlin.math.*

data class Vec3(val x: Float, val y: Float, val z: Float) {
    operator fun plus(b: Vec3) = Vec3(x + b.x, y + b.y, z + b.z)

    operator fun minus(b: Vec3) = Vec3(x - b.x, y - b.y, z - b.z)

    operator fun times(s: Float) = Vec3(x * s, y * s, z * s)

    fun dot(b: Vec3) = x * b.x + y * b.y + z * b.z

    fun cross(b: Vec3) = Vec3(y * b.z - z * b.y, z * b.x - x * b.z, x * b.y - y * b.x)

    fun normalized(): Vec3 {
        val length = sqrt(dot(this))
        return if (length < 1e-12f) Vec3(0f, 1f, 0f) else this * (1f / length)
    }

    companion object {
        val ZERO = Vec3(0f, 0f, 0f)
    }
}

object Mat4 {
    fun identity() = floatArrayOf(1f, 0f, 0f, 0f, 0f, 1f, 0f, 0f, 0f, 0f, 1f, 0f, 0f, 0f, 0f, 1f)

    fun multiply(a: FloatArray, b: FloatArray): FloatArray =
        FloatArray(16) { i ->
            val row = i % 4
            val col = i / 4
            (0..3).sumOf { k -> (a[k * 4 + row] * b[col * 4 + k]).toDouble() }.toFloat()
        }

    fun point(m: FloatArray, p: Vec3, w: Float = 1f): Vec3 {
        val divisor = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15] * w
        val d = if (w == 0f || abs(divisor) < 1e-12f) 1f else divisor
        return Vec3(
            (m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12] * w) / d,
            (m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13] * w) / d,
            (m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14] * w) / d,
        )
    }

    fun inverse(m: FloatArray): FloatArray {
        val rows =
            Array(4) { r ->
                DoubleArray(8) { c ->
                    if (c < 4) m[c * 4 + r].toDouble() else if (c - 4 == r) 1.0 else 0.0
                }
            }
        for (column in 0..3) {
            val pivot = (column..3).maxBy { abs(rows[it][column]) }
            require(abs(rows[pivot][column]) > 1e-15) { "Вырожденное преобразование модели" }
            val swap = rows[column]
            rows[column] = rows[pivot]
            rows[pivot] = swap
            val scale = rows[column][column]
            for (c in 0..7) rows[column][c] /= scale
            for (r in 0..3) if (r != column) {
                val factor = rows[r][column]
                for (c in 0..7) rows[r][c] -= rows[column][c] * factor
            }
        }
        return FloatArray(16) { rows[it % 4][it / 4 + 4].toFloat() }
    }

    fun normal(matrix: FloatArray, n: Vec3): Vec3 {
        val inv = inverse(matrix)
        return Vec3(
                inv[0] * n.x + inv[1] * n.y + inv[2] * n.z,
                inv[4] * n.x + inv[5] * n.y + inv[6] * n.z,
                inv[8] * n.x + inv[9] * n.y + inv[10] * n.z,
            )
            .normalized()
    }

    fun trs(t: FloatArray, q: FloatArray, s: FloatArray): FloatArray {
        val x = q[0]
        val y = q[1]
        val z = q[2]
        val w = q[3]
        return floatArrayOf(
            (1 - 2 * y * y - 2 * z * z) * s[0],
            (2 * x * y + 2 * z * w) * s[0],
            (2 * x * z - 2 * y * w) * s[0],
            0f,
            (2 * x * y - 2 * z * w) * s[1],
            (1 - 2 * x * x - 2 * z * z) * s[1],
            (2 * y * z + 2 * x * w) * s[1],
            0f,
            (2 * x * z + 2 * y * w) * s[2],
            (2 * y * z - 2 * x * w) * s[2],
            (1 - 2 * x * x - 2 * y * y) * s[2],
            0f,
            t[0],
            t[1],
            t[2],
            1f,
        )
    }
}

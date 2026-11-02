package ru.dndshare.client.maps.geometry

import kotlin.math.*
import ru.dndshare.client.maps.*

data class FogColumn(val areaId: String, val min: DoubleArray, val max: DoubleArray)

data class VolumeFogField(
    val min: DoubleArray,
    val size: DoubleArray,
    val dimensions: IntArray,
    val data: ByteArray,
    val masks: Map<String, IntArray>,
) {
    fun weights(weight: (String) -> Double) {
        data.fill(0)
        for ((id, indices) in masks) {
            val amount = weight(id).coerceIn(0.0, 1.0)
            if (amount == 0.0) continue
            for (packed in indices) {
                val index = packed and 0x3fffff
                val value = ((packed ushr 22) * amount).roundToInt()
                data[index] = maxOf(data[index].toInt() and 255, value).toByte()
            }
        }
    }
}

fun mapFogColumns(
    context: MapContext,
    active: (String) -> Boolean = { id ->
        context.areas[id]?.let { it.flag("fog") && !it.flag("hidden") } == true
    },
): List<FogColumn> {
    val owners = mutableMapOf<String, String>()
    for ((id, area) in context.areas) if (active(id))
        for (tile in area.ids("tileIds")) owners[tile] = id
    return context.tiles.values.mapNotNull { tile ->
        val id = tile.string("id")
        val area = owners[id] ?: return@mapNotNull null
        val model = context.models[tile.string("modelId")] ?: return@mapNotNull null
        val size = mapFootprint(tile, model)
        val floor = context.placements[id]?.elevation ?: 0.0
        val height = max(.2, model.maxHeight - model.mountDepth)
        FogColumn(
            area,
            doubleArrayOf(tile.number("x"), floor - .14, tile.number("y")),
            doubleArrayOf(
                tile.number("x") + size.first,
                floor + max(1.25, height + .9),
                tile.number("y") + size.second,
            ),
        )
    }
}

private fun smoothFog(value: Double): Double {
    val t = value.coerceIn(0.0, 1.0)
    return t * t * (3 - 2 * t)
}

/** Byte-for-byte counterpart of volumeFogField.js, including sparse per-area masks. */
fun buildMapFogField(columns: List<FogColumn>): VolumeFogField? {
    if (columns.isEmpty()) return null
    val min = DoubleArray(3) { Double.POSITIVE_INFINITY }
    val max = DoubleArray(3) { Double.NEGATIVE_INFINITY }
    for (column in columns) for (axis in 0..2) {
        val pad = if (axis == 1) .55 else .32 + .55
        min[axis] = min(min[axis], column.min[axis] - pad)
        max[axis] = max(max[axis], column.max[axis] + pad)
    }
    val size = DoubleArray(3) { max[it] - min[it] }
    val limits = intArrayOf(192, 96, 192)
    val dimensions =
        IntArray(3) { ceil(size[it] * if (it == 1) 5 else 4).toInt().coerceIn(4, limits[it]) }
    val nx = dimensions[0]
    val ny = dimensions[1]
    val nz = dimensions[2]
    val step = DoubleArray(3) { size[it] / dimensions[it] }
    val data = ByteArray(nx * ny * nz)
    val scratch = ByteArray(data.size)
    val masks = linkedMapOf<String, IntArray>()
    for ((id, group) in columns.groupBy { it.areaId }) {
        val indices = FogIndices()
        for (column in group) {
            val lo =
                IntArray(3) {
                    max(
                        0,
                        floor((column.min[it] - (if (it == 1) 0.0 else .32) - min[it]) / step[it])
                            .toInt(),
                    )
                }
            val hi =
                IntArray(3) {
                    min(
                        dimensions[it] - 1,
                        ceil((column.max[it] + (if (it == 1) 0.0 else .32) - min[it]) / step[it])
                            .toInt(),
                    )
                }
            for (z in lo[2]..hi[2]) for (y in lo[1]..hi[1]) for (x in lo[0]..hi[0]) {
                val px = min[0] + (x + .5) * step[0]
                val py = min[1] + (y + .5) * step[1]
                val pz = min[2] + (z + .5) * step[2]
                val edge =
                    minOf(
                        px - column.min[0],
                        column.max[0] - px,
                        pz - column.min[2],
                        column.max[2] - pz,
                    )
                val outside =
                    hypot(
                        maxOf(column.min[0] - px, 0.0, px - column.max[0]),
                        maxOf(column.min[2] - pz, 0.0, pz - column.max[2]),
                    )
                val density =
                    smoothFog(if (edge < 0) 1 - outside / .32 else 1.0) *
                        smoothFog((py - column.min[1]) / .2) *
                        smoothFog((column.max[1] - py) / .65)
                val value = (density * 255).roundToInt()
                if (value == 0) continue
                val index = (z * ny + y) * nx + x
                if (scratch[index] == 0.toByte()) indices.add(index)
                scratch[index] = maxOf(scratch[index].toInt() and 255, value).toByte()
            }
        }
        masks[id] =
            IntArray(indices.size) { i ->
                val index = indices[i]
                val density = scratch[index].toInt() and 255
                data[index] = maxOf(data[index].toInt() and 255, density).toByte()
                scratch[index] = 0
                (density shl 22) or index
            }
    }
    return VolumeFogField(min, size, dimensions, data, masks)
}

fun mapFogNoise(): ByteArray {
    var seed = 0x1234abcd
    return ByteArray(32 * 32 * 32) {
        seed = seed xor (seed shl 13)
        seed = seed xor (seed ushr 17)
        seed = seed xor (seed shl 5)
        seed.toByte()
    }
}

private class FogIndices {
    private var values = IntArray(1024)
    var size = 0
        private set

    fun add(value: Int) {
        if (size == values.size) values = values.copyOf(values.size * 2)
        values[size++] = value
    }

    operator fun get(index: Int) = values[index]
}

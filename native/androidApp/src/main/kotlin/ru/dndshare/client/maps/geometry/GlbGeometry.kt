package ru.dndshare.client.maps.geometry

import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*

data class MeshGeometry(
    val positions: FloatArray,
    val normals: FloatArray,
    val uv: FloatArray,
    val colors: FloatArray,
    val water: FloatArray,
    val indices: IntArray,
) {
    val count
        get() = positions.size / 3

    fun position(i: Int) = Vec3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])

    fun normal(i: Int) = Vec3(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2])
}

data class GlbPart(
    val geometry: MeshGeometry,
    val material: JsonObject,
    val node: Int,
    val primitive: Int,
)

fun GlbDocument.parts(): List<GlbPart> {
    val nodes = json.array("nodes")
    val result = mutableListOf<GlbPart>()
    val visiting = mutableSetOf<Int>()
    fun visit(index: Int, parent: FloatArray) {
        require(visiting.add(index) && visiting.size < 128) { "Некорректная иерархия модели" }
        val node = nodes[index].jsonObject
        fun floats(key: String, size: Int, default: Float) =
            FloatArray(size) {
                node.array(key).getOrNull(it)?.jsonPrimitive?.floatOrNull ?: default
            }
        val local =
            if (node["matrix"] is JsonArray) floats("matrix", 16, 0f)
            else
                Mat4.trs(
                    floats("translation", 3, 0f),
                    FloatArray(4) {
                        node.array("rotation").getOrNull(it)?.jsonPrimitive?.floatOrNull
                            ?: if (it == 3) 1f else 0f
                    },
                    floats("scale", 3, 1f),
                )
        val matrix = Mat4.multiply(parent, local)
        node["mesh"]?.jsonPrimitive?.intOrNull?.let { meshId ->
            val mesh = json.array("meshes")[meshId].jsonObject
            mesh.rows("primitives").forEachIndexed { primitiveId, primitive ->
                val mode = primitive.number("mode", 4.0).toInt()
                if (mode !in 4..6) return@forEachIndexed
                val attributes = primitive.getValue("attributes").jsonObject
                val vertices = accessor(attributes.getValue("POSITION").jsonPrimitive.int)
                fun attr(key: String) = attributes[key]?.jsonPrimitive?.intOrNull?.let(::accessor)
                val normals = attr("NORMAL")
                val uv = attr("TEXCOORD_0")
                val colors = attr("COLOR_0")
                val water = attr("_WATER") ?: attr("_water")
                val input =
                    primitive["indices"]?.jsonPrimitive?.intOrNull?.let {
                        accessor(it).values.map(Float::toInt).toIntArray()
                    } ?: IntArray(vertices.count) { it }
                val indices =
                    when (mode) {
                        5 ->
                            (0 until input.size - 2)
                                .flatMap { i ->
                                    if (i % 2 == 0) listOf(input[i], input[i + 1], input[i + 2])
                                    else listOf(input[i + 1], input[i], input[i + 2])
                                }
                                .toIntArray()
                        6 ->
                            (1 until input.size - 1)
                                .flatMap { listOf(input[0], input[it], input[it + 1]) }
                                .toIntArray()
                        else -> input
                    }
                require(indices.size % 3 == 0 && indices.all { it in 0 until vertices.count })
                val determinant =
                    matrix[0] * (matrix[5] * matrix[10] - matrix[9] * matrix[6]) -
                        matrix[4] * (matrix[1] * matrix[10] - matrix[9] * matrix[2]) +
                        matrix[8] * (matrix[1] * matrix[6] - matrix[5] * matrix[2])
                if (determinant < 0f)
                    for (i in indices.indices step 3) {
                        val swap = indices[i + 1]
                        indices[i + 1] = indices[i + 2]
                        indices[i + 2] = swap
                    }
                val positions = FloatArray(vertices.count * 3)
                val directions = FloatArray(positions.size)
                val inverse = Mat4.inverse(matrix)
                for (i in 0 until vertices.count) {
                    val p = Mat4.point(matrix, vertices.vector(i))
                    positions[i * 3] = p.x
                    positions[i * 3 + 1] = p.y
                    positions[i * 3 + 2] = p.z
                    if (normals != null) {
                        val n = normals.vector(i)
                        val world =
                            Vec3(
                                    inverse[0] * n.x + inverse[1] * n.y + inverse[2] * n.z,
                                    inverse[4] * n.x + inverse[5] * n.y + inverse[6] * n.z,
                                    inverse[8] * n.x + inverse[9] * n.y + inverse[10] * n.z,
                                )
                                .normalized()
                        directions[i * 3] = world.x
                        directions[i * 3 + 1] = world.y
                        directions[i * 3 + 2] = world.z
                    }
                }
                if (normals == null)
                    for (t in indices.indices step 3) {
                        fun p(i: Int) =
                            Vec3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
                        val a = indices[t]
                        val b = indices[t + 1]
                        val c = indices[t + 2]
                        val n = (p(b) - p(a)).cross(p(c) - p(a)).normalized()
                        for (i in intArrayOf(a, b, c)) {
                            directions[i * 3] += n.x
                            directions[i * 3 + 1] += n.y
                            directions[i * 3 + 2] += n.z
                        }
                    }
                if (normals == null)
                    for (i in 0 until vertices.count) {
                        val normal =
                            Vec3(directions[i * 3], directions[i * 3 + 1], directions[i * 3 + 2])
                                .normalized()
                        directions[i * 3] = normal.x
                        directions[i * 3 + 1] = normal.y
                        directions[i * 3 + 2] = normal.z
                    }
                val geometry =
                    MeshGeometry(
                        positions,
                        directions,
                        FloatArray(vertices.count * 2) { uv?.values?.getOrNull(it) ?: 0f },
                        FloatArray(vertices.count * 4) { i ->
                            colors?.values?.getOrNull((i / 4) * colors.components + i % 4)?.takeIf {
                                i % 4 < colors.components
                            } ?: 1f
                        },
                        FloatArray(vertices.count * 2) {
                            water?.values?.getOrNull(it) ?: if (it % 2 == 0) 1f else -1f
                        },
                        indices,
                    )
                result +=
                    GlbPart(
                        geometry,
                        primitive["material"]?.jsonPrimitive?.intOrNull?.let {
                            json.array("materials")[it].jsonObject
                        } ?: buildJsonObject {},
                        index,
                        primitiveId,
                    )
            }
        }
        for (child in node.array("children")) visit(child.jsonPrimitive.int, matrix)
        visiting -= index
    }
    val scene = json.array("scenes").getOrNull(json.number("scene").toInt()) as? JsonObject
    for (root in scene?.array("nodes").orEmpty()) visit(root.jsonPrimitive.int, Mat4.identity())
    return result
}

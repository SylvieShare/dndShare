package ru.dndshare.client.maps.rendering

import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.model.WireJson

internal const val MAP_NODE_NAME = "dndshare-node-"
internal const val MAP_PART_NAME = "dndshare-part-"

internal data class MapPreparedModel(
    val bytes: ByteArray,
    val materials: Map<MapPrimitiveRef, JsonObject>,
)

internal data class MapNamedPart(val node: Int, val primitive: Int? = null)

internal fun mapNamedPart(name: String?): MapNamedPart? {
    if (name == null) return null
    if (name.startsWith(MAP_NODE_NAME))
        return name.removePrefix(MAP_NODE_NAME).toIntOrNull()?.let { MapNamedPart(it) }
    if (!name.startsWith(MAP_PART_NAME)) return null
    val values = name.removePrefix(MAP_PART_NAME).split('-')
    if (values.size != 2) return null
    return MapNamedPart(
        values[0].toIntOrNull() ?: return null,
        values[1].toIntOrNull() ?: return null,
    )
}

/**
 * Mixed transparent meshes become separate renderables; their original buffers and transforms stay
 * shared.
 */
internal fun prepareMapModel(bytes: ByteArray): MapPreparedModel {
    val source = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
    require(source.int == 0x46546c67 && source.int == 2 && source.int == bytes.size)
    val oldLength = source.int
    require(source.int == 0x4e4f534a && oldLength >= 0 && oldLength <= source.remaining())
    val json =
        WireJson.parseToJsonElement(
                String(bytes, 20, oldLength, Charsets.UTF_8).trimEnd(' ', '\u0000')
            )
            .jsonObject
    val originalNodes = json.rows("nodes")
    // gltfio rejects application semantics such as _WATER. Native effects read these from the
    // original GLB in MapAssetCache; only the copy submitted to gltfio drops custom attributes.
    val originalMeshes =
        json.rows("meshes").map { mesh ->
            mesh.with(
                "primitives",
                JsonArray(
                    mesh.rows("primitives").map { part ->
                        val attributes = part["attributes"] as? JsonObject
                        if (attributes == null || attributes.keys.none { it.startsWith("_") }) part
                        else
                            part.with(
                                "attributes",
                                JsonObject(attributes.filterKeys { !it.startsWith("_") }),
                            )
                    }
                ),
            )
        }
    if (
        originalMeshes.none { mesh ->
            mesh.rows("primitives").any {
                (it["attributes"] as? JsonObject)?.containsKey("POSITION") == true
            }
        }
    )
        throw MapPermanentLoadException("В файле модели нет геометрии")
    val materials = json.rows("materials")
    val meshes = originalMeshes.toMutableList()
    val nodes =
        originalNodes
            .mapIndexed { index, node -> node.with("name", JsonPrimitive("$MAP_NODE_NAME$index")) }
            .toMutableList()
    val split = mutableMapOf<Int, List<Int>>()
    val descriptors = mutableMapOf<MapPrimitiveRef, JsonObject>()
    for ((index, node) in originalNodes.withIndex()) {
        val meshId = (node["mesh"] as? JsonPrimitive)?.intOrNull ?: continue
        val mesh = originalMeshes[meshId]
        val parts = mesh.rows("primitives")
        fun material(part: JsonObject) =
            materials.getOrNull(part.number("material", -1.0).toInt()) ?: JsonObject(emptyMap())
        for ((primitive, part) in parts.withIndex()) descriptors[
            MapPrimitiveRef(index, primitive)] = material(part)
        if (parts.size <= 1 || parts.none { material(it).string("alphaMode") == "BLEND" }) continue
        val ids =
            split.getOrPut(meshId) {
                parts.mapIndexed { primitive, part ->
                    val value = mesh.with("primitives", JsonArray(listOf(part)))
                    if (primitive == 0) {
                        meshes[meshId] = value
                        meshId
                    } else {
                        meshes += value
                        meshes.lastIndex
                    }
                }
            }
        val children = node.array("children").toMutableList()
        for (primitive in 1 until ids.size) {
            val child = buildJsonObject {
                put("name", "$MAP_PART_NAME$index-$primitive")
                put("mesh", ids[primitive])
                node["skin"]?.let { put("skin", it) }
                node["weights"]?.let { put("weights", it) }
            }
            children += JsonPrimitive(nodes.size)
            nodes += child
        }
        nodes[index] = nodes[index].with("children", JsonArray(children))
    }
    val named =
        json
            .with("nodes", JsonArray(nodes))
            .with("meshes", JsonArray(meshes))
            .toString()
            .toByteArray()
    val length = (named.size + 3) / 4 * 4
    val result = ByteArray(bytes.size - oldLength + length)
    ByteBuffer.wrap(result).order(ByteOrder.LITTLE_ENDIAN).apply {
        putInt(0x46546c67)
        putInt(2)
        putInt(result.size)
        putInt(length)
        putInt(0x4e4f534a)
        put(named)
    }
    for (i in named.size until length) result[20 + i] = 32
    bytes.copyInto(result, 20 + length, 20 + oldLength)
    return MapPreparedModel(result, descriptors)
}

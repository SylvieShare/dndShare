package ru.dndshare.client.maps.rendering

import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.model.WireJson

internal const val MAP_NODE_NAME = "dndshare-node-"

/**
 * Stable public gltfio names map CPU nodes to every instance, without copying the binary chunk
 * twice.
 */
internal fun mapNamedGlb(bytes: ByteArray): ByteArray {
    val source = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
    require(source.int == 0x46546c67 && source.int == 2 && source.int == bytes.size)
    val oldLength = source.int
    require(source.int == 0x4e4f534a && oldLength >= 0 && oldLength <= source.remaining())
    val json =
        WireJson.parseToJsonElement(
                String(bytes, 20, oldLength, Charsets.UTF_8).trimEnd(' ', '\u0000')
            )
            .jsonObject
    val named =
        json
            .with(
                "nodes",
                JsonArray(
                    json.rows("nodes").mapIndexed { index, node ->
                        node.with("name", JsonPrimitive("$MAP_NODE_NAME$index"))
                    }
                ),
            )
            .toString()
            .toByteArray()
    val length = (named.size + 3) / 4 * 4
    val size = bytes.size - oldLength + length
    val result = ByteArray(size)
    ByteBuffer.wrap(result).order(ByteOrder.LITTLE_ENDIAN).apply {
        putInt(0x46546c67)
        putInt(2)
        putInt(size)
        putInt(length)
        putInt(0x4e4f534a)
        put(named)
    }
    for (i in named.size until length) result[20 + i] = 32
    bytes.copyInto(result, 20 + length, 20 + oldLength)
    return result
}

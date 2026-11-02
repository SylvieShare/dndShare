package ru.dndshare.client.maps.geometry

import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.max
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.model.WireJson

/** Read-only CPU counterpart of gltfio, used for decals and effect geometry. */
class GlbDocument(bytes: ByteArray) {
    val json: JsonObject
    private val binary: ByteArray
    private val views = mutableMapOf<Int, ByteArray>()

    init {
        require(bytes.size >= 20)
        val data = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        require(data.int == 0x46546c67 && data.int == 2 && data.int == bytes.size) {
            "Некорректный GLB"
        }
        var structure: JsonObject? = null
        var payload = ByteArray(0)
        while (data.remaining() >= 8) {
            val length = data.int
            val type = data.int
            require(length >= 0 && length <= data.remaining())
            val chunk = ByteArray(length)
            data.get(chunk)
            if (type == 0x4e4f534a)
                structure =
                    WireJson.parseToJsonElement(
                            chunk.toString(Charsets.UTF_8).trimEnd(' ', '\u0000')
                        )
                        .jsonObject
            if (type == 0x004e4942) payload = chunk
        }
        json = requireNotNull(structure)
        binary = payload
    }

    fun bufferView(index: Int): ByteArray =
        views.getOrPut(index) {
            val view = json.array("bufferViews")[index].jsonObject
            val encoded =
                (view["extensions"] as? JsonObject)?.get("EXT_meshopt_compression") as? JsonObject
            if (encoded != null) {
                require(encoded.number("buffer").toInt() == 0)
                val mode =
                    listOf("ATTRIBUTES", "TRIANGLES", "INDICES").indexOf(encoded.string("mode"))
                val filter =
                    listOf("NONE", "OCTAHEDRAL", "QUATERNION", "EXPONENTIAL", "COLOR")
                        .indexOf(encoded.string("filter", "NONE"))
                require(mode >= 0 && filter >= 0)
                Meshopt.decode(
                    slice(
                        encoded.number("byteOffset").toInt(),
                        encoded.number("byteLength").toInt(),
                    ),
                    encoded.number("count").toInt(),
                    encoded.number("byteStride").toInt(),
                    mode,
                    filter,
                )
            } else {
                require(view.number("buffer").toInt() == 0) {
                    "Модель должна содержать собственные бинарные данные"
                }
                slice(view.number("byteOffset").toInt(), view.number("byteLength").toInt())
            }
        }

    private fun slice(offset: Int, length: Int): ByteArray {
        require(offset >= 0 && length >= 0 && offset.toLong() + length <= binary.size)
        return binary.copyOfRange(offset, offset + length)
    }

    fun accessor(index: Int): GlbAccessor {
        val item = json.array("accessors")[index].jsonObject
        val components =
            mapOf("SCALAR" to 1, "VEC2" to 2, "VEC3" to 3, "VEC4" to 4, "MAT4" to 16)[
                item.string("type")] ?: error("Неподдерживаемый атрибут модели")
        val type = item.number("componentType").toInt()
        val size =
            when (type) {
                5120,
                5121 -> 1
                5122,
                5123 -> 2
                5125,
                5126 -> 4
                else -> error("Некорректный тип атрибута")
            }
        val count = item.number("count").toInt()
        require(count in 0..4_000_000)
        val viewIndex = item["bufferView"]?.jsonPrimitive?.intOrNull
        val view = viewIndex?.let { json.array("bufferViews")[it].jsonObject }
        val stride =
            view?.number("byteStride", (size * components).toDouble())?.toInt() ?: size * components
        val raw = viewIndex?.let(::bufferView) ?: ByteArray(count * components * size)
        val buffer = ByteBuffer.wrap(raw).order(ByteOrder.LITTLE_ENDIAN)
        val start = item.number("byteOffset").toInt()
        require(
            count == 0 ||
                start >= 0 && start.toLong() + (count - 1L) * stride + components * size <= raw.size
        )
        val normalized = item.flag("normalized")
        fun component(buffer: ByteBuffer, offset: Int): Float =
            when (type) {
                5120 ->
                    buffer.get(offset).toFloat().let { if (normalized) max(-1f, it / 127f) else it }
                5121 ->
                    (buffer.get(offset).toInt() and 255).toFloat().let {
                        if (normalized) it / 255f else it
                    }
                5122 ->
                    buffer.getShort(offset).toFloat().let {
                        if (normalized) max(-1f, it / 32767f) else it
                    }
                5123 ->
                    (buffer.getShort(offset).toInt() and 65535).toFloat().let {
                        if (normalized) it / 65535f else it
                    }
                5125 -> (buffer.getInt(offset).toLong() and 0xffffffffL).toFloat()
                else -> buffer.getFloat(offset)
            }
        val values =
            FloatArray(count * components) { i ->
                component(buffer, start + (i / components) * stride + (i % components) * size)
            }
        val sparse = item["sparse"] as? JsonObject
        if (sparse != null) {
            val indices = sparse.getValue("indices").jsonObject
            val replacements = sparse.getValue("values").jsonObject
            val idBuffer =
                ByteBuffer.wrap(bufferView(indices.number("bufferView").toInt()))
                    .order(ByteOrder.LITTLE_ENDIAN)
            val valBuffer =
                ByteBuffer.wrap(bufferView(replacements.number("bufferView").toInt()))
                    .order(ByteOrder.LITTLE_ENDIAN)
            val idType = indices.number("componentType").toInt()
            val idSize = if (idType == 5121) 1 else if (idType == 5123) 2 else 4
            for (i in 0 until sparse.number("count").toInt()) {
                val at = indices.number("byteOffset").toInt() + i * idSize
                val id =
                    when (idType) {
                        5121 -> idBuffer.get(at).toInt() and 255
                        5123 -> idBuffer.getShort(at).toInt() and 65535
                        else -> idBuffer.getInt(at)
                    }
                require(id in 0 until count)
                for (c in 0 until components) {
                    val p = replacements.number("byteOffset").toInt() + (i * components + c) * size
                    values[id * components + c] = component(valBuffer, p)
                }
            }
        }
        return GlbAccessor(values, components)
    }

    fun image(index: Int): ByteArray {
        val image = json.array("images")[index].jsonObject
        val view = image["bufferView"]?.jsonPrimitive?.intOrNull
        if (view != null) return bufferView(view)
        val uri = image.string("uri")
        require(uri.startsWith("data:") && uri.contains(";base64,")) {
            "Изображение модели должно быть встроено в GLB"
        }
        return java.util.Base64.getDecoder().decode(uri.substringAfter(","))
    }
}

data class GlbAccessor(val values: FloatArray, val components: Int) {
    val count
        get() = values.size / components

    fun vector(index: Int) =
        Vec3(
            values[index * components],
            values[index * components + 1],
            values[index * components + 2],
        )
}

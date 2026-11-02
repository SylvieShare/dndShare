package ru.dndshare.client.maps.rendering

import android.graphics.Bitmap
import com.google.android.filament.*
import kotlin.math.*
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.*

internal data class MapWaterTexture(
    val key: String,
    val bitmap: Bitmap,
    val srgb: Boolean,
    val transform: FloatArray,
)

internal data class MapWaterPart(val part: GlbPart, val textures: Map<String, MapWaterTexture>)

internal fun prepareWaterTextures(
    source: GlbDocument,
    parts: List<GlbPart>,
    url: String,
): List<MapWaterPart> {
    val decoded = mutableMapOf<Int, Bitmap>()
    fun texture(info: JsonObject?, srgb: Boolean): MapWaterTexture? {
        val id = info?.get("index")?.jsonPrimitive?.intOrNull ?: return null
        val texture = source.json.array("textures")[id].jsonObject
        val image =
            ((texture["extensions"] as? JsonObject)?.get("KHR_texture_basisu") as? JsonObject)
                ?.number("source")
                ?.toInt() ?: texture.number("source").toInt()
        val bitmap = decoded.getOrPut(image) { MapTextureCodec.decode(source.image(image)) }
        val transform =
            ((info["extensions"] as? JsonObject)?.get("KHR_texture_transform") as? JsonObject)
        val offset = transform?.array("offset")
        val scale = transform?.array("scale")
        val angle = transform?.number("rotation") ?: 0.0
        val c = cos(angle)
        val s = sin(angle)
        val sx = scale?.double(0, 1.0) ?: 1.0
        val sy = scale?.double(1, 1.0) ?: 1.0
        return MapWaterTexture(
            "$url:$image",
            bitmap,
            srgb,
            floatArrayOf(
                (c * sx).toFloat(),
                (s * sx).toFloat(),
                0f,
                (-s * sy).toFloat(),
                (c * sy).toFloat(),
                0f,
                (offset?.double(0) ?: 0.0).toFloat(),
                (offset?.double(1) ?: 0.0).toFloat(),
                1f,
            ),
        )
    }
    try {
        return parts.mapNotNull { part ->
            val pbr = part.material["pbrMetallicRoughness"] as? JsonObject ?: return@mapNotNull null
            val settings = mutableMapOf<String, MapWaterTexture>()
            texture(pbr["baseColorTexture"] as? JsonObject, true)?.let { settings["albedo"] = it }
            texture(pbr["metallicRoughnessTexture"] as? JsonObject, false)?.let {
                settings["orm"] = it
            }
            texture(part.material["normalTexture"] as? JsonObject, false)?.let {
                settings["normalMap"] = it
            }
            texture(part.material["emissiveTexture"] as? JsonObject, true)?.let {
                settings["emissiveMap"] = it
            }
            MapWaterPart(part, settings)
        }
    } catch (error: Throwable) {
        decoded.values.forEach(Bitmap::recycle)
        throw error
    }
}

internal fun configureWaterMaterial(
    gpu: MapGpuMaterials,
    prepared: MapWaterPart,
): MaterialInstance =
    gpu.configure("water") { instance ->
        val sampler =
            TextureSampler(
                TextureSampler.MinFilter.LINEAR_MIPMAP_LINEAR,
                TextureSampler.MagFilter.LINEAR,
                TextureSampler.WrapMode.REPEAT,
            )
        val identity = floatArrayOf(1f, 0f, 0f, 0f, 1f, 0f, 0f, 0f, 1f)
        val neutral =
            mapOf(
                "albedo" to intArrayOf(255, 255, 255, 255),
                "orm" to intArrayOf(255, 255, 255, 255),
                "normalMap" to intArrayOf(128, 128, 255, 255),
                "emissiveMap" to intArrayOf(0, 0, 0, 255),
            )
        for ((name, colour) in neutral) {
            val ref = prepared.textures[name]
            val texture =
                if (ref != null) gpu.texture(ref.key, ref.bitmap, ref.srgb)
                else gpu.solid("neutral-$name", colour, name in setOf("albedo", "emissiveMap"))
            instance.setParameter(name, texture, sampler)
            instance.setParameter(
                "${name}Transform",
                MaterialInstance.FloatElement.MAT3,
                ref?.transform ?: identity,
                0,
                1,
            )
        }
        val material = prepared.part.material
        val pbr = material["pbrMetallicRoughness"] as? JsonObject ?: JsonObject(emptyMap())
        val base = pbr.array("baseColorFactor")
        instance.setParameter(
            "baseFactor",
            base.double(0, 1.0).toFloat(),
            base.double(1, 1.0).toFloat(),
            base.double(2, 1.0).toFloat(),
            base.double(3, 1.0).toFloat(),
        )
        instance.setParameter(
            "factors",
            pbr.number("metallicFactor", 1.0).toFloat(),
            pbr.number("roughnessFactor", 1.0).toFloat(),
            (material["normalTexture"] as? JsonObject)?.number("scale", 1.0)?.toFloat() ?: 1f,
            0f,
        )
        val emissive = material.array("emissiveFactor")
        val power =
            ((material["extensions"] as? JsonObject)?.get("KHR_materials_emissive_strength")
                    as? JsonObject)
                ?.number("emissiveStrength", 1.0) ?: 1.0
        instance.setParameter(
            "emissiveFactor",
            (emissive.double(0) * power).toFloat(),
            (emissive.double(1) * power).toFloat(),
            (emissive.double(2) * power).toFloat(),
        )
        instance.setPolygonOffset(-1f, -1f) // Filament handles reversed Z in this API.
    }

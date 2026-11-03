package ru.dndshare.client.maps.rendering

import android.content.res.AssetManager
import android.graphics.Bitmap
import com.google.android.filament.*
import java.nio.ByteBuffer

/** Everything in this owner is created and destroyed on the renderer looper. */
internal class MapGpuMaterials(private val engine: Engine, private val assets: AssetManager) :
    AutoCloseable {
    private val materials = mutableMapOf<String, Material>()
    private val textures = mutableMapOf<String, Texture>()
    private val bindings = mutableMapOf<MaterialInstance, MutableSet<String>>()

    fun duplicate(instance: MaterialInstance): MaterialInstance {
        val copy = MaterialInstance.duplicate(instance)
        bindings[copy] = bindings[instance].orEmpty().toMutableSet()
        return copy
    }

    fun release(instance: MaterialInstance) {
        engine.destroyMaterialInstance(instance)
        val keys = bindings.remove(instance).orEmpty()
        val used = bindings.values.flatten().toSet()
        for (key in keys) if (key !in used) textures.remove(key)?.let(engine::destroyTexture)
    }

    fun instance(name: String): MaterialInstance =
        materials
            .getOrPut(name) {
                val bytes = assets.open("maps/materials/$name.filamat").use { it.readBytes() }
                Material.Builder().payload(ByteBuffer.wrap(bytes), bytes.size).build(engine)
            }
            .createInstance()

    fun configure(name: String, block: (MaterialInstance) -> Unit): MaterialInstance {
        val value = instance(name)
        try {
            block(value)
            return value
        } catch (error: Throwable) {
            release(value)
            throw error
        }
    }

    fun texture(instance: MaterialInstance, key: String, bitmap: Bitmap, srgb: Boolean): Texture {
        val id = "$key:$srgb"
        bindings.getOrPut(instance) { mutableSetOf() }.add(id)
        return textures.getOrPut(id) {
            val pixels = ByteBuffer.allocateDirect(bitmap.byteCount)
            bitmap.copyPixelsToBuffer(pixels)
            pixels.flip()
            val texture =
                Texture.Builder()
                    .width(bitmap.width)
                    .height(bitmap.height)
                    .levels(0xff)
                    .sampler(Texture.Sampler.SAMPLER_2D)
                    .usage(Texture.Usage.DEFAULT or Texture.Usage.GEN_MIPMAPPABLE)
                    .format(
                        if (srgb) Texture.InternalFormat.SRGB8_A8 else Texture.InternalFormat.RGBA8
                    )
                    .build(engine)
            try {
                texture.setImage(
                    engine,
                    0,
                    Texture.PixelBufferDescriptor(
                        pixels,
                        Texture.Format.RGBA,
                        Texture.Type.UBYTE,
                    ),
                )
                texture.generateMipmaps(engine)
                texture
            } catch (error: Throwable) {
                engine.destroyTexture(texture)
                throw error
            }
        }
    }

    fun solid(
        instance: MaterialInstance,
        key: String,
        rgba: IntArray,
        srgb: Boolean = false,
    ): Texture {
        val id = "$key:$srgb"
        bindings.getOrPut(instance) { mutableSetOf() }.add(id)
        return textures[id]
            ?: run {
                val image = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
                image.setPixel(
                    0,
                    0,
                    android.graphics.Color.argb(rgba[3], rgba[0], rgba[1], rgba[2]),
                )
                try {
                    texture(instance, key, image, srgb)
                } finally {
                    image.recycle()
                }
            }
    }

    override fun close() {
        bindings.clear()
        materials.values.forEach(engine::destroyMaterial)
        materials.clear()
        textures.values.forEach(engine::destroyTexture)
        textures.clear()
    }
}

internal fun mapLinearColour(value: String): FloatArray {
    val hex = value.removePrefix("#").toLongOrNull(16) ?: 0xffffff
    fun channel(shift: Int): Float {
        val c = ((hex shr shift) and 255) / 255f
        return if (c <= .04045f) c / 12.92f
        else Math.pow(((c + .055f) / 1.055f).toDouble(), 2.4).toFloat()
    }
    return floatArrayOf(channel(16), channel(8), channel(0))
}

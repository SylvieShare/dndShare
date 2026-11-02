package ru.dndshare.client.maps.rendering

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.cos
import kotlin.math.sin
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*

data class MapSceneEntry(val id: String, val model: MapModel, val matrix: FloatArray)

fun mapSceneEntries(document: JsonObject, models: Map<String, MapModel>): List<MapSceneEntry> {
    val placements = mapPlacements(document, models)
    val hiddenTiles =
        document
            .rows("areas")
            .filter { it.flag("hidden") }
            .flatMap { (it["tileIds"] as? JsonArray).orEmpty().map { it.jsonPrimitive.content } }
            .toSet()
    val hiddenObjects =
        document
            .rows("areas")
            .filter { it.flag("hidden") }
            .flatMap { (it["objectIds"] as? JsonArray).orEmpty().map { it.jsonPrimitive.content } }
            .toSet()
    val foggedTiles =
        document.rows("areas").filter { it.flag("fog") }.flatMap { it.ids("tileIds") }.toSet()
    val foggedObjects =
        document.rows("areas").filter { it.flag("fog") }.flatMap { it.ids("objectIds") }.toSet()
    return document
        .rows("tiles")
        .filter { it.string("id") !in hiddenTiles }
        .mapNotNull { tile ->
            models[tile.string("modelId")]?.let { model ->
                val (w, h) = mapFootprint(tile, model)
                val transform =
                    mapTransform(
                        tile.number("x") + w / 2.0,
                        tile.number("y") + h / 2.0,
                        (placements[tile.string("id")]?.elevation ?: 0.0) - model.mountDepth,
                        tile.number("rotation"),
                        mirrored = tile.flag("mirrored"),
                    )
                val ox = model.placementOffset.getOrElse(0) { 0.0 }
                val oy = model.placementOffset.getOrElse(1) { 0.0 }
                transform[12] += (transform[0] * ox + transform[8] * oy).toFloat()
                transform[14] += (transform[2] * ox + transform[10] * oy).toFloat()
                MapSceneEntry(tile.string("id"), model, transform)
            }
        } +
        document
            .rows("objects")
            .filter { it.string("id") !in hiddenObjects && it.string("id") !in foggedObjects }
            .mapNotNull { obj ->
                models[obj.string("modelId")]?.let { model ->
                    val anchor = obj["placement"] as? JsonObject
                    val tile =
                        document.rows("tiles").find { it.string("id") == anchor?.string("tileId") }
                    val support = tile?.let { models[it.string("modelId")] }
                    if (tile?.string("id") in hiddenTiles || tile?.string("id") in foggedTiles)
                        return@mapNotNull null
                    val point =
                        support?.placementPoints?.getOrNull(anchor?.number("point")?.toInt() ?: -1)
                            as? JsonObject
                    val pose =
                        if (tile != null && support != null && point != null)
                            mapSurface(
                                tile,
                                support,
                                point,
                                placements[tile.string("id")]?.elevation ?: 0.0,
                            )
                        else MapPose(obj.number("x"), obj.number("y"), obj.number("elevation", .44))
                    MapSceneEntry(
                        obj.string("id"),
                        model,
                        mapTransform(
                            pose.x,
                            pose.y,
                            pose.elevation,
                            obj.number("rotation"),
                            obj.number("scale", 1.0),
                        ),
                    )
                }
            }
}

fun mapTransform(
    x: Double,
    y: Double,
    elevation: Double,
    degrees: Double,
    scale: Double = 1.0,
    mirrored: Boolean = false,
): FloatArray {
    val angle = Math.toRadians(-degrees)
    val c = cos(angle).toFloat() * scale.toFloat()
    val s = sin(angle).toFloat() * scale.toFloat()
    val sign = if (mirrored) -1f else 1f
    return floatArrayOf(
        c * sign,
        0f,
        -s * sign,
        0f,
        0f,
        scale.toFloat(),
        0f,
        0f,
        s,
        0f,
        c,
        0f,
        x.toFloat(),
        elevation.toFloat(),
        y.toFloat(),
        1f,
    )
}

/** A tiny local GLB ground plane; it needs no network or runtime shader compiler. */
fun mapGroundGlb(width: Int, height: Int, grid: Boolean): ByteBuffer {
    val image = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(image)
    canvas.drawColor(Color.rgb(32, 32, 39))
    if (grid) {
        val paint =
            Paint().apply {
                color = Color.rgb(63, 63, 75)
                strokeWidth = 1f
            }
        canvas.drawLine(0f, 0f, 64f, 0f, paint)
        canvas.drawLine(0f, 0f, 0f, 64f, paint)
    }
    val png =
        ByteArrayOutputStream()
            .also { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
            .toByteArray()
    image.recycle()
    val geometrySize = 4 * 3 * 4 + 4 * 2 * 4 + 6 * 2
    val binSize = (geometrySize + png.size + 3) / 4 * 4
    val bin = ByteBuffer.allocate(binSize).order(ByteOrder.LITTLE_ENDIAN)
    for (f in
        floatArrayOf(
            0f,
            -.02f,
            0f,
            0f,
            -.02f,
            height.toFloat(),
            width.toFloat(),
            -.02f,
            height.toFloat(),
            width.toFloat(),
            -.02f,
            0f,
        )) bin.putFloat(f)
    for (f in
        floatArrayOf(
            0f,
            0f,
            0f,
            height.toFloat(),
            width.toFloat(),
            height.toFloat(),
            width.toFloat(),
            0f,
        )) bin.putFloat(f)
    for (i in shortArrayOf(0, 1, 2, 0, 2, 3)) bin.putShort(i)
    bin.put(png)
    val json =
        """{"asset":{"version":"2.0"},"extensionsUsed":["KHR_materials_unlit"],
        "buffers":[{"byteLength":$binSize}],"bufferViews":[{"buffer":0,"byteOffset":0,"byteLength":48},
        {"buffer":0,"byteOffset":48,"byteLength":32},{"buffer":0,"byteOffset":80,"byteLength":12},
        {"buffer":0,"byteOffset":92,"byteLength":${png.size}}],
        "accessors":[{"bufferView":0,"componentType":5126,"count":4,"type":"VEC3","min":[0,-0.02,0],"max":[$width,-0.02,$height]},
        {"bufferView":1,"componentType":5126,"count":4,"type":"VEC2"},{"bufferView":2,"componentType":5123,"count":6,"type":"SCALAR"}],
        "images":[{"bufferView":3,"mimeType":"image/png"}],"samplers":[{"magFilter":9729,"minFilter":9987,"wrapS":10497,"wrapT":10497}],
        "textures":[{"sampler":0,"source":0}],"materials":[{"doubleSided":true,"extensions":{"KHR_materials_unlit":{}},"pbrMetallicRoughness":{"baseColorTexture":{"index":0},"metallicFactor":0,"roughnessFactor":1}}],
        "meshes":[{"primitives":[{"attributes":{"POSITION":0,"TEXCOORD_0":1},"indices":2,"material":0}]}],"nodes":[{"mesh":0}],"scenes":[{"nodes":[0]}],"scene":0}"""
            .replace("\n", "")
            .toByteArray()
    val jsonSize = (json.size + 3) / 4 * 4
    return ByteBuffer.allocateDirect(12 + 8 + jsonSize + 8 + binSize)
        .order(ByteOrder.LITTLE_ENDIAN)
        .apply {
            putInt(0x46546c67)
            putInt(2)
            putInt(capacity())
            putInt(jsonSize)
            putInt(0x4e4f534a)
            put(json)
            repeat(jsonSize - json.size) { put(32.toByte()) }
            putInt(binSize)
            putInt(0x004e4942)
            put(bin.array())
            flip()
        }
}

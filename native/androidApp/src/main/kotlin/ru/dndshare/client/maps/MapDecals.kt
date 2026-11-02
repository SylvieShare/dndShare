package ru.dndshare.client.maps

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.geometry.Vec3

@kotlinx.serialization.Serializable
data class MapDecalImage(
    val id: String,
    val name: String,
    val category: String,
    val imageUrl: String,
    val pixelWidth: Int = 1,
    val pixelHeight: Int = 1,
)

val builtinMapDecals =
    listOf(
            Triple("blood-splash", "Брызги крови", "traces"),
            Triple("blood-pool", "Лужа крови", "traces"),
            Triple("mud", "Грязь", "traces"),
            Triple("rune", "Руна", "graffiti"),
            Triple("arrow", "Стрелка", "graffiti"),
            Triple("wanted", "Разыскивается", "posters"),
        )
        .map { (id, name, category) ->
            MapDecalImage(id, name, category, "/images/maps/decals/$id.svg")
        }

fun newMapDecal(
    image: MapDecalImage,
    kind: String,
    owner: String,
    point: Vec3,
    normal: Vec3,
): JsonObject = buildJsonObject {
    put("id", UUID.randomUUID().toString())
    put("name", image.name)
    put("category", image.category)
    put("imageUrl", image.imageUrl)
    put(
        "anchor",
        buildJsonObject {
            put("kind", kind)
            put("id", owner)
        },
    )
    put("position", numbers(point.x.toDouble(), point.y.toDouble(), point.z.toDouble()))
    put("normal", numbers(normal.x.toDouble(), normal.y.toDouble(), normal.z.toDouble()))
    put("width", 1)
    put(
        "height",
        (image.pixelHeight.toDouble() / image.pixelWidth.coerceAtLeast(1)).coerceIn(.02, 16.0),
    )
    put("depth", .15)
    put("rotation", 0)
    put("opacity", 1)
    put("color", "#ffffff")
}

fun updateMapDecal(document: JsonObject, id: String, key: String, value: JsonElement): JsonObject {
    val decal = requireNotNull(document.rows("decals").find { it.string("id") == id })
    val numeric =
        mapOf(
            "width" to .02..16.0,
            "height" to .02..16.0,
            "depth" to .01..8.0,
            "opacity" to 0.0..1.0,
            "rotation" to -360.0..360.0,
        )
    numeric[key]?.let {
        require(value.jsonPrimitive.double in it) { "Значение вне допустимого диапазона" }
    }
    if (key == "color") require(value.jsonPrimitive.content.matches(Regex("#[0-9a-fA-F]{6}")))
    return mapReplace(document, "decals", decal.with(key, value))
}

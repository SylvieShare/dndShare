package ru.dndshare.client.maps

import java.util.UUID
import kotlin.math.*
import kotlinx.serialization.json.*

data class MapLightPose(
    val source: JsonObject,
    val point: MapPose,
    val height: Double,
    val opacity: Float,
) {
    val worldHeight
        get() = point.elevation + height
}

fun mapLightPose(light: JsonObject, context: MapContext): MapLightPose {
    val anchor = light["anchor"] as? JsonObject
    val kind = anchor?.string("kind").orEmpty()
    val id = anchor?.string("id").orEmpty()
    val owner = if (kind == "tile") context.tiles[id] else context.objects[id]
    val model = context.models[owner?.string("modelId")]
    val template =
        model?.behaviour?.rows("defaultLights")?.find {
            it.string("key") == light.string("builtinKey") &&
                light.string("builtinKey").isNotBlank()
        }
    val overrides = light["overrides"] as? JsonObject
    val effective = if (overrides != null) JsonObject(light + overrides) else light
    var point = MapPose(light.number("x"), light.number("y"), light.number("elevation"))
    var height = effective.number("height")
    if (owner != null) {
        if (template != null) {
            val position = template.array("position")
            height =
                overrides?.get("height")?.jsonPrimitive?.doubleOrNull
                    ?: position.double(2) *
                        if (kind == "object") owner.number("scale", 1.0) else 1.0
            if (kind == "tile") {
                point =
                    mapSurface(
                        owner,
                        model,
                        buildJsonObject {
                            put(
                                "x",
                                position.double(0) + model.placementOffset.getOrElse(0) { 0.0 },
                            )
                            put(
                                "y",
                                position.double(1) + model.placementOffset.getOrElse(1) { 0.0 },
                            )
                            put("elevation", model.mountDepth)
                        },
                        context.placements[id]?.elevation ?: 0.0,
                    )
            } else {
                val base = context.objectPose(owner)
                val angle = Math.toRadians(owner.number("rotation"))
                val scale = owner.number("scale", 1.0)
                val x = (position.double(0) - model.width / 2.0) * scale
                val y = (position.double(1) - model.height / 2.0) * scale
                point =
                    MapPose(
                        base.x + x * cos(angle) - y * sin(angle),
                        base.y + x * sin(angle) + y * cos(angle),
                        base.elevation,
                    )
            }
        } else {
            val angle = Math.toRadians(owner.number("rotation"))
            if (kind == "tile" && model != null) {
                val size = mapFootprint(owner, model)
                point =
                    MapPose(
                        owner.number("x") + size.first / 2.0,
                        owner.number("y") + size.second / 2.0,
                        (context.placements[id]?.elevation ?: 0.0) + model.surfaceHeight -
                            model.mountDepth,
                    )
            } else {
                val base = context.objectPose(owner)
                point =
                    base.copy(
                        elevation =
                            base.elevation + (model?.maxHeight ?: 0.0) * owner.number("scale", 1.0)
                    )
            }
            val offset = light.array("offset")
            val x = offset.double(0) * if (kind == "tile" && owner.flag("mirrored")) -1 else 1
            val y = offset.double(1)
            point =
                point.copy(
                    x = point.x + x * cos(angle) - y * sin(angle),
                    y = point.y + x * sin(angle) + y * cos(angle),
                )
        }
    }
    val area = if (anchor != null) context.area(kind, id) else context.areas[light.string("areaId")]
    val opacity =
        if (area?.flag("fog") == true) 0f
        else if (anchor != null) context.opacity(kind, id)
        else if (area?.flag("hidden") == true) .12f else 1f
    return MapLightPose(effective, point, height, opacity)
}

fun mapFirePose(pose: MapLightPose, context: MapContext): MapLightPose {
    val effect = pose.source["effect"] as? JsonObject ?: return pose
    val anchor = pose.source["anchor"] as? JsonObject
    val owner =
        if (anchor?.string("kind") == "tile") context.tiles[anchor.string("id")]
        else context.objects[anchor?.string("id")]
    val offset = effect.array("offset")
    val angle = Math.toRadians(owner?.number("rotation") ?: 0.0)
    val x =
        offset.double(0) *
            if (anchor?.string("kind") == "tile" && owner?.flag("mirrored") == true) -1 else 1
    val y = offset.double(1)
    return pose.copy(
        point =
            pose.point.copy(
                x = pose.point.x + x * cos(angle) - y * sin(angle),
                y = pose.point.y + x * sin(angle) + y * cos(angle),
            ),
        height = pose.height + offset.double(2),
    )
}

fun newMapLight(kind: String, point: MapPose): JsonObject {
    val preset =
        when (kind) {
            "candle" -> Triple("Свеча", "#ffd899", listOf(3.0, 2.5, .4))
            "magic" -> Triple("Магический свет", "#a98aff", listOf(10.0, 5.5, 1.0))
            else -> Triple("Факел", "#ffc36a", listOf(8.0, 4.5, .9))
        }
    return buildJsonObject {
        put("id", UUID.randomUUID().toString())
        put("name", preset.first)
        put("kind", kind)
        put("color", preset.second)
        put("x", point.x)
        put("y", point.y)
        put("elevation", point.elevation)
        put("intensity", preset.third[0])
        put("radius", preset.third[1])
        put("height", preset.third[2])
        put("enabled", true)
        put("showMarker", true)
        put("shadows", true)
        put("flicker", kind != "magic")
        put("offset", numbers(0.0, 0.0))
    }
}

fun mapUpdateLight(document: JsonObject, id: String, key: String, value: JsonElement): JsonObject {
    val light = requireNotNull(document.rows("lights").find { it.string("id") == id })
    val overridable =
        setOf(
            "color",
            "height",
            "intensity",
            "radius",
            "flicker",
            "showMarker",
            "shadows",
            "effect",
        )
    var next = light.with(key, value)
    if (light.string("builtinKey").isNotBlank()) {
        require(key == "enabled" || key in overridable) {
            "Параметр встроенного источника фиксирован"
        }
        if (key in overridable)
            next =
                next.with(
                    "overrides",
                    (light["overrides"] as? JsonObject ?: buildJsonObject {}).with(key, value),
                )
    }
    return mapReplace(document, "lights", next)
}

fun mapBindLight(
    document: JsonObject,
    catalogue: Collection<MapModel>,
    id: String,
    anchor: JsonObject?,
): JsonObject {
    val light = requireNotNull(document.rows("lights").find { it.string("id") == id })
    require(light.string("builtinKey").isBlank()) { "Привязка встроенного света фиксирована" }
    val context = MapContext(document, catalogue)
    val pose = mapLightPose(light, context)
    var next =
        light
            .with("x", JsonPrimitive(pose.point.x))
            .with("y", JsonPrimitive(pose.point.y))
            .with("elevation", JsonPrimitive(pose.point.elevation))
    if (anchor == null) next = next.without("anchor").with("offset", numbers(0.0, 0.0))
    else {
        val owner =
            if (anchor.string("kind") == "tile") context.tiles[anchor.string("id")]
            else context.objects[anchor.string("id")]
        require(owner != null) { "Опора света отсутствует" }
        next = next.with("anchor", anchor).without("areaId").with("offset", numbers(0.0, 0.0))
    }
    return mapReplace(document, "lights", next)
}

fun scaleMapEffect(value: JsonElement?, scale: Double): JsonElement? =
    (value as? JsonObject)?.let { effect ->
        effect
            .with(
                "size",
                JsonArray(
                    effect.array("size").map { JsonPrimitive(it.jsonPrimitive.double * scale) }
                ),
            )
            .with(
                "offset",
                JsonArray(
                    effect.array("offset").map { JsonPrimitive(it.jsonPrimitive.double * scale) }
                ),
            )
    }

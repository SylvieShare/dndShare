package ru.dndshare.client.maps

import java.util.UUID
import kotlinx.serialization.json.*

/** Derived attachment data follows the same templates as the server and web. */
fun normalizeMapDocument(source: JsonObject, catalogue: Collection<MapModel>): JsonObject {
    var doc = source
    val models = catalogue.associateBy { it.uuid }
    val tiles = doc.rows("tiles").associateBy { it.string("id") }
    doc =
        doc.with(
            "objects",
            JsonArray(
                doc.rows("objects").filter { row ->
                    val anchor = row["placement"] as? JsonObject
                    anchor == null || anchor.string("tileId") in tiles
                }
            ),
        )
    var context = MapContext(doc, catalogue)
    doc =
        doc.with(
            "objects",
            JsonArray(
                doc.rows("objects").map { row ->
                    if (row["placement"] !is JsonObject) row
                    else
                        context.objectPose(row).let { pose ->
                            row.with("x", JsonPrimitive(pose.x)).with("y", JsonPrimitive(pose.y))
                        }
                }
            ),
        )
    val objects = doc.rows("objects").map { it.string("id") }.toSet()
    doc =
        doc.with(
            "areas",
            JsonArray(
                doc.rows("areas").map { area ->
                    area
                        .with(
                            "tileIds",
                            JsonArray(
                                area.array("tileIds").filter { it.jsonPrimitive.content in tiles }
                            ),
                        )
                        .with(
                            "objectIds",
                            JsonArray(
                                area.array("objectIds").filter {
                                    it.jsonPrimitive.content in objects
                                }
                            ),
                        )
                }
            ),
        )
    if (doc["decals"] != null) {
        val decals =
            doc.rows("decals").filter { decal ->
                val anchor = decal["anchor"] as? JsonObject
                if (anchor?.string("kind") == "tile") anchor.string("id") in tiles
                else anchor?.string("id") in objects
            }
        doc = if (decals.isEmpty()) doc.without("decals") else doc.with("decals", JsonArray(decals))
    }
    val previous =
        doc.rows("lights").associateBy { row ->
            val anchor = row["anchor"] as? JsonObject
            "${anchor?.string("kind")}:${anchor?.string("id")}:${row.string("builtinKey")}"
        }
    val result = doc.rows("lights").filter { it.string("builtinKey").isBlank() }.toMutableList()
    for ((kind, rows) in
        listOf("tile" to doc.rows("tiles"), "object" to doc.rows("objects"))) for (row in rows) {
        val model = models[row.string("modelId")] ?: continue
        val scale = if (kind == "object") row.number("scale", 1.0) else 1.0
        for (template in model.behaviour.rows("defaultLights")) {
            val old = previous["$kind:${row.string("id")}:${template.string("key")}"]
            val overrides = old?.get("overrides") as? JsonObject
            val fields =
                template.toMutableMap().apply {
                    remove("key")
                    remove("position")
                    put("id", JsonPrimitive(old?.string("id") ?: UUID.randomUUID().toString()))
                    put("builtinKey", template.getValue("key"))
                    put("enabled", JsonPrimitive(old?.flag("enabled") ?: template.flag("enabled")))
                    put("height", JsonPrimitive(template.array("position").double(2) * scale))
                    put("x", old?.get("x") ?: JsonPrimitive(0))
                    put("y", old?.get("y") ?: JsonPrimitive(0))
                    put("elevation", old?.get("elevation") ?: JsonPrimitive(0))
                    put("showMarker", JsonPrimitive(false))
                    put("shadows", JsonPrimitive(false))
                    put("offset", numbers(0.0, 0.0))
                    put(
                        "anchor",
                        buildJsonObject {
                            put("kind", kind)
                            put("id", row.string("id"))
                        },
                    )
                    scaleMapEffect(template["effect"], scale)?.let { put("effect", it) }
                    if (overrides != null) {
                        put("overrides", overrides)
                        putAll(overrides)
                    }
                }
            result += JsonObject(fields)
        }
    }
    context = MapContext(doc, catalogue)
    val areas = context.areas.keys
    doc =
        doc.with(
            "lights",
            JsonArray(
                result.mapNotNull { light ->
                    val anchor = light["anchor"] as? JsonObject
                    if (
                        anchor != null &&
                            (if (anchor.string("kind") == "tile") anchor.string("id") !in tiles
                            else anchor.string("id") !in objects)
                    )
                        return@mapNotNull null
                    var next =
                        if (
                            anchor != null ||
                                light.string("areaId").isNotEmpty() &&
                                    light.string("areaId") !in areas
                        )
                            light.without("areaId")
                        else light
                    if (anchor != null) {
                        val pose = mapLightPose(next, context)
                        next =
                            next
                                .with("x", JsonPrimitive(pose.point.x))
                                .with("y", JsonPrimitive(pose.point.y))
                                .with("elevation", JsonPrimitive(pose.point.elevation))
                    } else
                        next =
                            next
                                .with(
                                    "x",
                                    JsonPrimitive(
                                        next.number("x").coerceIn(0.0, doc.number("width"))
                                    ),
                                )
                                .with(
                                    "y",
                                    JsonPrimitive(
                                        next.number("y").coerceIn(0.0, doc.number("height"))
                                    ),
                                )
                    next
                }
            ),
        )
    return doc
}

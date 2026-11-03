package ru.dndshare.client.maps

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.rendering.MapCamera

data class MapPlacementView(
    val camera: MapCamera,
    val x: Double,
    val y: Double,
    val width: Int,
    val height: Int,
)

data class MapPlacementBuild(val document: JsonObject, val selected: Set<MapEntityRef>)

/** Pure placement calculation, suitable for the coalesced background preview worker. */
fun buildMapPlacement(
    document: JsonObject,
    catalogue: List<MapModel>,
    tool: MapTool,
    rotation: Int,
    mirrored: Boolean,
    point: MapPose,
    view: MapPlacementView?,
    fillRoom: Boolean = false,
    newId: (MapEntityRef) -> String = { UUID.randomUUID().toString() },
): MapPlacementBuild {
    val models = catalogue.associateBy { it.uuid }
    val result =
        when (tool) {
            is MapTool.Model -> {
                val model = requireNotNull(models[tool.modelId]) { "Модель недоступна" }
                if (model.isObject) {
                    require(document.rows("objects").size < 1000) {
                        "На карте может быть до 1000 объектов"
                    }
                    val context = MapContext(document, catalogue)
                    val target =
                        if (view != null)
                            mapSurfacePointInView(
                                context,
                                view.camera,
                                view.x,
                                view.y,
                                view.width,
                                view.height,
                            )
                        else
                            context.nearestSurface(point)?.let {
                                MapSurfacePoint(it.first, it.second)
                            }
                    requireNotNull(target) { "На карте нет свободных точек размещения" }
                    val key = newId(MapEntityRef(MapEntityKind.Object, "model"))
                    val row = buildJsonObject {
                        put("id", key)
                        put("modelId", model.uuid)
                        put("kind", "chest")
                        put("x", target.point.x)
                        put("y", target.point.y)
                        put("scale", 1)
                        put("rotation", rotation)
                        put("open", false)
                        put("placement", target.anchor)
                    }
                    MapPlacementBuild(
                        document.with("objects", JsonArray(document.rows("objects") + row)),
                        setOf(MapEntityRef(MapEntityKind.Object, key)),
                    )
                } else {
                    val context = MapStructureContext(document, models)
                    val candidates =
                        if (view == null) listOf(MapPlacementPoint(point, 0))
                        else
                            mapPlacementPoints(
                                context,
                                model,
                                view.camera,
                                view.x,
                                view.y,
                                view.width,
                                view.height,
                                rotation,
                            )
                    val size = mapFootprint(buildJsonObject { put("rotation", rotation) }, model)
                    if (fillRoom) {
                        require(size.first == 1 && size.second == 1) {
                            "Заливка доступна для плиток 1 × 1"
                        }
                        val target = candidates.first()
                        val cells =
                            requireNotNull(
                                mapEnclosedCells(document, target.point, models, target.level)
                            ) {
                                "Нужна замкнутая пустая область"
                            }
                        val rows = cells.map { (x, y) ->
                            buildJsonObject {
                                put(
                                    "id",
                                    newId(
                                        MapEntityRef(
                                            MapEntityKind.Tile,
                                            "fill-$x-$y-${target.level}",
                                        )
                                    ),
                                )
                                put("modelId", model.uuid)
                                put("x", x)
                                put("y", y)
                                put("rotation", rotation)
                                put("level", target.level)
                                if (mirrored) put("mirrored", true)
                            }
                        }
                        MapPlacementBuild(
                            document.with("tiles", JsonArray(document.rows("tiles") + rows)),
                            rows.map { MapEntityRef(MapEntityKind.Tile, it.string("id")) }.toSet(),
                        )
                    } else {
                        val key = newId(MapEntityRef(MapEntityKind.Tile, "model"))
                        var chosen: MapNearbyPlacement? = null
                        for (candidate in candidates) {
                            val tile = buildJsonObject {
                                put("id", key)
                                put("modelId", model.uuid)
                                put("x", candidate.point.x - size.first / 2.0)
                                put("y", candidate.point.y - size.second / 2.0)
                                put("rotation", rotation)
                                put("level", candidate.level)
                                if (mirrored) put("mirrored", true)
                            }
                            chosen = nearestMapTilePlacement(document, tile, models)
                            if (chosen != null) break
                        }
                        val tile =
                            requireNotNull(chosen) {
                                    "Нет допустимого положения рядом с указателем"
                                }
                                .tile
                        MapPlacementBuild(
                            document.with("tiles", JsonArray(document.rows("tiles") + tile)),
                            setOf(MapEntityRef(MapEntityKind.Tile, key)),
                        )
                    }
                }
            }
            is MapTool.Light -> {
                require(document.rows("lights").count { it.string("builtinKey").isBlank() } < 32) {
                    "Не более 32 ручных источников"
                }
                require(
                    point.x in 0.0..document.number("width") &&
                        point.y in 0.0..document.number("height")
                ) {
                    "Источник должен находиться на карте"
                }
                val key = newId(MapEntityRef(MapEntityKind.Light, "source"))
                MapPlacementBuild(
                    document.with(
                        "lights",
                        JsonArray(
                            document.rows("lights") +
                                newMapLight(tool.preset, point).with("id", JsonPrimitive(key))
                        ),
                    ),
                    setOf(MapEntityRef(MapEntityKind.Light, key)),
                )
            }
            is MapTool.Paste -> {
                val tiles = tool.payload.document.rows("tiles")
                val root = tiles.minByOrNull { it.number("level") }
                if (root == null || view == null)
                    mapPaste(document, catalogue, tool.payload, point, 0, newId, tool.pivot).let {
                        MapPlacementBuild(it.first, it.second)
                    }
                else {
                    val model = models.getValue(root.string("modelId"))
                    val size = mapFootprint(root, model)
                    val single = tiles.size == 1 && tool.payload.document.rows("objects").isEmpty()
                    val anchor =
                        if (single)
                            MapPose(
                                root.number("x") + size.first / 2.0,
                                root.number("y") + size.second / 2.0,
                            )
                        else tool.pivot
                    val offset =
                        MapPose(
                            anchor.x - root.number("x") - size.first / 2.0,
                            anchor.y - root.number("y") - size.second / 2.0,
                        )
                    val context = MapStructureContext(document, models)
                    val candidates =
                        mapPlacementPoints(
                            context,
                            model,
                            view.camera,
                            view.x,
                            view.y,
                            view.width,
                            view.height,
                            root.number("rotation").toInt(),
                            grabOffset = offset,
                        )
                    var built: MapPlacementBuild? = null
                    for (candidate in candidates) {
                        val tile =
                            root
                                .with(
                                    "x",
                                    JsonPrimitive(candidate.point.x - offset.x - size.first / 2.0),
                                )
                                .with(
                                    "y",
                                    JsonPrimitive(candidate.point.y - offset.y - size.second / 2.0),
                                )
                                .with("level", JsonPrimitive(candidate.level))
                        val nearby =
                            nearestMapTilePlacement(
                                document,
                                tile,
                                models,
                                group = tiles,
                                origin = root,
                            ) ?: continue
                        val pivot =
                            MapPose(
                                nearby.tile.number("x") + offset.x + size.first / 2.0,
                                nearby.tile.number("y") + offset.y + size.second / 2.0,
                            )
                        built =
                            mapPaste(
                                    document,
                                    catalogue,
                                    tool.payload,
                                    pivot,
                                    candidate.level - root.number("level").toInt(),
                                    newId,
                                    tool.pivot,
                                )
                                .let { MapPlacementBuild(it.first, it.second) }
                        break
                    }
                    requireNotNull(built) { "Нет допустимого положения для группы" }
                }
            }
            else -> error("Инструмент не размещает объекты")
        }
    mapPlacements(result.document, models)
    return result.copy(document = normalizeMapDocument(result.document, catalogue))
}

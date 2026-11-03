package ru.dndshare.client.ui.maps

import androidx.compose.runtime.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import ru.dndshare.client.maps.*

/** Selection by projected geometry; attached entities remain independent typed references. */
internal class MapRectangleSelection(private val workspace: MapEditorWorkspace) {
    var bounds by mutableStateOf<Rect?>(null)
        private set

    private var origin: Offset? = null

    fun move(start: Offset, end: Offset, finished: Boolean) {
        origin = start
        val rect =
            Rect(
                minOf(start.x, end.x),
                minOf(start.y, end.y),
                maxOf(start.x, end.x),
                maxOf(start.y, end.y),
            )
        bounds = rect
        if (!finished) return
        val scene = workspace.scene ?: return cancel()
        val doc = workspace.current.map?.document ?: return cancel()
        val models = workspace.current.models.associateBy { it.uuid }
        val poses = runCatching { mapPlacements(doc, models) }.getOrDefault(emptyMap())
        val context = MapContext(doc, models.values)
        val camera = scene.camera()
        val refs = buildSet {
            for (tile in doc.rows("tiles")) {
                val model = models[tile.string("modelId")] ?: continue
                val (width, height) = mapFootprint(tile, model)
                val points =
                    listOf(0 to 0, width to 0, width to height, 0 to height).map { (x, y) ->
                        camera.project(
                            MapPose(
                                tile.number("x") + x,
                                tile.number("y") + y,
                                poses[tile.string("id")]?.elevation ?: 0.0,
                            ),
                            scene.width,
                            scene.height,
                        )
                    }
                val footprint =
                    Rect(
                        points.minOf { it.first },
                        points.minOf { it.second },
                        points.maxOf { it.first },
                        points.maxOf { it.second },
                    )
                if (rect.overlaps(footprint))
                    add(MapEntityRef(MapEntityKind.Tile, tile.string("id")))
            }
            for (obj in doc.rows("objects")) {
                val pose = context.objectPose(obj)
                val point = camera.project(pose, scene.width, scene.height)
                if (rect.contains(Offset(point.first, point.second)))
                    add(MapEntityRef(MapEntityKind.Object, obj.string("id")))
            }
        }
        workspace.controller.ui { ui ->
            ui.copy(
                focus =
                    MapFocus(
                        (if (ui.multiple) ui.focus.selected + refs else refs.toList()).distinct()
                    ),
                focusOpen = true,
                rectangle = false,
            )
        }
        cancel()
    }

    fun cancel() {
        origin = null
        bounds = null
    }
}

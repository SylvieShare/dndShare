package ru.dndshare.client.ui.maps

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.ui.designsystem.*

private data class Annotation(
    val ref: MapEntityRef,
    val pose: MapPose,
    val icon: Glyph,
    val target: Boolean = false,
)

@Composable
internal fun MapEditorAnnotations(workspace: MapEditorWorkspace) {
    val doc = workspace.preview ?: workspace.map?.document ?: return
    val scene = workspace.scene ?: return
    val camera by scene.cameraState.collectAsState()
    val lightPositions by scene.lightPositions.collectAsState()
    val context =
        remember(doc, workspace.models) {
            runCatching { MapContext(doc, workspace.models) }.getOrNull()
        } ?: return
    val annotations =
        remember(doc, context, workspace.ui.showCameras) {
            buildList {
                for (light in doc.rows("lights")) {
                    val posed = mapLightPose(light, context)
                    if (posed.opacity > .001f)
                        add(
                            Annotation(
                                MapEntityRef(MapEntityKind.Light, light.string("id")),
                                posed.point.copy(elevation = posed.worldHeight),
                                Glyph.Lightbulb,
                            )
                        )
                }
                if (workspace.ui.showCameras)
                    for (row in doc.rows("cameras")) {
                        val ref = MapEntityRef(MapEntityKind.Camera, row.string("id"))
                        val view = row["view"] as? JsonObject ?: continue
                        for (key in listOf("position", "target")) {
                            val p = view.array(key)
                            add(
                                Annotation(
                                    ref,
                                    MapPose(p.double(0), p.double(1), p.double(2)),
                                    if (key == "target") Glyph.Target else Glyph.Camera,
                                    key == "target",
                                )
                            )
                        }
                    }
            }
        }
    Box(Modifier.fillMaxSize()) {
        Canvas(Modifier.fillMaxSize()) {
            fun project(p: MapPose): Offset {
                val (x, y) = camera.project(p, size.width.toInt(), size.height.toInt())
                return Offset(x, y)
            }
            if (
                workspace.ui.showAnchors ||
                    workspace.currentUi.tool is MapTool.Model &&
                        context.models[(workspace.currentUi.tool as MapTool.Model).modelId]
                            ?.isObject == true
            ) {
                for (tile in doc.rows("tiles")) {
                    val model = context.models[tile.string("modelId")] ?: continue
                    for ((index, p) in model.placementPoints.withIndex()) {
                        val used =
                            doc.rows("objects").any {
                                (it["placement"] as? JsonObject)?.let { a ->
                                    a.string("tileId") == tile.string("id") &&
                                        a.number("point").toInt() == index
                                } == true
                            }
                        if (!used)
                            drawCircle(
                                WebPalette.Success.copy(alpha = .75f),
                                4.dp.toPx(),
                                project(
                                    mapSurface(
                                        tile,
                                        model,
                                        p.jsonObject,
                                        context.placements[tile.string("id")]?.elevation ?: 0.0,
                                    )
                                ),
                                style = Stroke(1.5.dp.toPx()),
                            )
                    }
                }
            }
            if (workspace.ui.showCameras)
                for (row in doc.rows("cameras")) {
                    val view = row["view"] as? JsonObject ?: continue
                    val p = view.array("position")
                    val t = view.array("target")
                    val color =
                        if (workspace.ui.focus.entity?.id == row.string("id")) WebPalette.AccentSoft
                        else WebPalette.TextMuted.copy(alpha = .65f)
                    drawLine(
                        color,
                        project(MapPose(p.double(0), p.double(1), p.double(2))),
                        project(MapPose(t.double(0), t.double(1), t.double(2))),
                        1.dp.toPx(),
                    )
                    if (workspace.ui.focus.entity?.id == row.string("id")) {
                        val saved = mapCameraView(view, scene.width)
                        val halfWidth = view.number("width") / 2
                        val halfHeight = halfWidth / view.number("aspect", 1.0)
                        val eye = saved.eye
                        val forward =
                            ru.dndshare.client.maps.geometry
                                .Vec3(
                                    (saved.x - eye[0]).toFloat(),
                                    (saved.elevation - eye[1]).toFloat(),
                                    (saved.y - eye[2]).toFloat(),
                                )
                                .normalized()
                        val up =
                            ru.dndshare.client.maps.geometry.Vec3(
                                saved.up[0].toFloat(),
                                saved.up[1].toFloat(),
                                saved.up[2].toFloat(),
                            )
                        val right = forward.cross(up).normalized()
                        val vertical = right.cross(forward).normalized()
                        val corners =
                            listOf(-1 to -1, 1 to -1, 1 to 1, -1 to 1).map { (x, y) ->
                                project(
                                    MapPose(
                                        saved.x +
                                            right.x * x * halfWidth +
                                            vertical.x * y * halfHeight,
                                        saved.y +
                                            right.z * x * halfWidth +
                                            vertical.z * y * halfHeight,
                                        saved.elevation +
                                            right.y * x * halfWidth +
                                            vertical.y * y * halfHeight,
                                    )
                                )
                            }
                        for (i in 0..3) drawLine(
                            color,
                            corners[i],
                            corners[(i + 1) % 4],
                            1.dp.toPx(),
                        )
                    }
                }
        }
        annotations.forEach { marker ->
            key(marker.ref, marker.target) {
                val actual =
                    if (marker.ref.kind == MapEntityKind.Light)
                        lightPositions[marker.ref.id] ?: marker.pose
                    else marker.pose
                val position = camera.project(actual, scene.width, scene.height)
                if (
                    position.first in -30f..(scene.width + 30f) &&
                        position.second in -30f..(scene.height + 30f)
                ) {
                    var dragOrigin by remember { mutableStateOf<Offset?>(null) }
                    var current by remember { mutableStateOf(Offset.Zero) }
                    val currentMarker by rememberUpdatedState(marker)
                    val selected =
                        marker.ref == workspace.ui.focus.entity ||
                            marker.ref in workspace.ui.focus.selected
                    Surface(
                        color =
                            if (selected) WebPalette.Active
                            else WebPalette.Popover.copy(alpha = .86f),
                        shape = CircleShape,
                        modifier =
                            Modifier.offset {
                                    IntOffset(
                                        position.first.toInt() - 16.dp.roundToPx(),
                                        position.second.toInt() - 16.dp.roundToPx(),
                                    )
                                }
                                .size(32.dp)
                                .pointerInput(marker.ref, marker.target) {
                                    detectTapGestures { workspace.focus(currentMarker.ref) }
                                }
                                .pointerInput(marker.ref, marker.target) {
                                    detectDragGesturesAfterLongPress(
                                        onDragStart = { start ->
                                            val p =
                                                Offset(position.first, position.second) + start -
                                                    Offset(16.dp.toPx(), 16.dp.toPx())
                                            dragOrigin = p
                                            current = p
                                            if (marker.ref.kind == MapEntityKind.Camera)
                                                workspace.cameraDrag.start(
                                                    marker.ref,
                                                    marker.target,
                                                    scene
                                                        .camera()
                                                        .world(
                                                            p.x.toDouble(),
                                                            p.y.toDouble(),
                                                            scene.width,
                                                            scene.height,
                                                            marker.pose.elevation,
                                                        ),
                                                )
                                            else
                                                workspace.drag.move(
                                                    MapPointer(
                                                        marker.ref,
                                                        scene
                                                            .camera()
                                                            .world(
                                                                p.x.toDouble(),
                                                                p.y.toDouble(),
                                                                scene.width,
                                                                scene.height,
                                                                marker.pose.elevation,
                                                            ),
                                                        p.x,
                                                        p.y,
                                                    ),
                                                    false,
                                                )
                                        },
                                        onDragEnd = {
                                            val p = current
                                            if (marker.ref.kind == MapEntityKind.Camera)
                                                workspace.cameraDrag.move(
                                                    scene
                                                        .camera()
                                                        .world(
                                                            p.x.toDouble(),
                                                            p.y.toDouble(),
                                                            scene.width,
                                                            scene.height,
                                                            marker.pose.elevation,
                                                        ),
                                                    true,
                                                )
                                            else
                                                workspace.drag.move(
                                                    MapPointer(
                                                        marker.ref,
                                                        scene
                                                            .camera()
                                                            .world(
                                                                p.x.toDouble(),
                                                                p.y.toDouble(),
                                                                scene.width,
                                                                scene.height,
                                                                marker.pose.elevation,
                                                            ),
                                                        p.x,
                                                        p.y,
                                                    ),
                                                    true,
                                                )
                                            dragOrigin = null
                                        },
                                        onDragCancel = {
                                            workspace.drag.cancel()
                                            workspace.cameraDrag.cancel()
                                            dragOrigin = null
                                        },
                                    ) { change, amount ->
                                        change.consume()
                                        current += amount
                                        val p = current
                                        val world =
                                            scene
                                                .camera()
                                                .world(
                                                    p.x.toDouble(),
                                                    p.y.toDouble(),
                                                    scene.width,
                                                    scene.height,
                                                    marker.pose.elevation,
                                                )
                                        if (marker.ref.kind == MapEntityKind.Camera)
                                            workspace.cameraDrag.move(world, false)
                                        else
                                            workspace.drag.move(
                                                MapPointer(marker.ref, world, p.x, p.y),
                                                false,
                                            )
                                    }
                                },
                    ) {
                        AppGlyph(
                            marker.icon,
                            Modifier.padding(7.dp),
                            if (selected) WebPalette.AccentSoft else WebPalette.TextSecondary,
                        )
                    }
                }
            }
        }
    }
}

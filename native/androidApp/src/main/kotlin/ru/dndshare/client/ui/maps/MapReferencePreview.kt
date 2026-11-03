package ru.dndshare.client.ui.maps

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapReferencePreview(workspace: MapEditorWorkspace, cache: MapAssetCache) {
    val reference = workspace.reference
    val draft = reference.draft ?: return
    val original = reference.model ?: return
    var scene by remember { mutableStateOf<FilamentMapScene?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val model =
        remember(original, draft.current) {
            runCatching {
                decodeMapModel(
                    JsonObject(
                        original.raw +
                            draft.current +
                            mapOf(
                                "renderUrl" to JsonPrimitive(original.renderUrl),
                                "lodUrl" to JsonPrimitive(original.lodUrl),
                                "uuid" to JsonPrimitive(original.uuid),
                                "id" to JsonPrimitive(original.id),
                            )
                    )
                )
            }
                .getOrNull()
        }
    if (model == null) {
        Text("Проверьте параметры модели", color = WebPalette.Danger)
        return
    }
    val tile =
        remember(model.width, model.height) {
            buildJsonObject {
                put("id", "reference-model")
                put("modelId", model.uuid)
                put("x", 1)
                put("y", 1)
                put("level", 0)
                put("rotation", 0)
            }
        }
    val document =
        remember(model) {
            val base =
                newMapDocument()
                    .with("width", JsonPrimitive((model.width + 2).coerceAtLeast(3)))
                    .with("height", JsonPrimitive((model.height + 2).coerceAtLeast(3)))
                    .with("grid", buildJsonObject { put("visible", false) })
            val content =
                if (!model.isObject) base.with("tiles", JsonArray(listOf(tile)))
                else
                    base.with(
                        "objects",
                        JsonArray(
                            listOf(
                                buildJsonObject {
                                    put("id", "reference-model")
                                    put("modelId", model.uuid)
                                    put("kind", "chest")
                                    put("x", 1 + model.width / 2.0)
                                    put("y", 1 + model.height / 2.0)
                                    put("elevation", 0)
                                    put("scale", 1)
                                    put("rotation", 0)
                                }
                            )
                        ),
                    )
            runCatching { normalizeMapDocument(content, listOf(model)) }.getOrDefault(content)
        }
    Box(Modifier.fillMaxWidth().height(300.dp)) {
        MapSceneView(
            document,
            listOf(model),
            cache,
            emptySet(),
            orbit = true,
            tap = {},
            drag = { _, _ -> },
            cancel = {},
            renderer = { scene = it },
            status = { count, message ->
                error = message
                if (count == 0) scene?.fitContents()
            },
        )
        val camera = scene?.cameraState?.collectAsState()?.value
        if (camera != null && scene != null && !model.isObject)
            BoxWithConstraints(Modifier.fillMaxSize()) {
                val projection = scene!!
                Canvas(Modifier.fillMaxSize()) {
                    for ((index, slot) in model.supportSlots.withIndex()) {
                        val data = slot.jsonObject
                        val corners =
                            listOf(
                                    0.0 to 0.0,
                                    data.number("width") to 0.0,
                                    data.number("width") to data.number("height"),
                                    0.0 to data.number("height"),
                                )
                                .map { (x, y) ->
                                    val point =
                                        mapSurface(
                                            tile,
                                            model,
                                            buildJsonObject {
                                                put("x", data.number("x") + x)
                                                put("y", data.number("y") + y)
                                                put("elevation", data.number("elevation"))
                                            },
                                            0.0,
                                        )
                                    camera.project(point, projection.width, projection.height)
                                }
                        val path =
                            Path().apply {
                                corners.forEachIndexed { i, p ->
                                    if (i == 0) moveTo(p.first, p.second)
                                    else lineTo(p.first, p.second)
                                }
                                close()
                            }
                        drawPath(
                            path,
                            if (index == reference.selectedSlot) WebPalette.AccentSoft
                            else WebPalette.Accent.copy(alpha = .5f),
                            style =
                                Stroke(
                                    if (index == reference.selectedSlot) 3.dp.toPx()
                                    else 1.dp.toPx()
                                ),
                        )
                    }
                }
                model.placementPoints.forEachIndexed { index, value ->
                    val point = mapSurface(tile, model, value.jsonObject, 0.0)
                    val pos = camera.project(point, projection.width, projection.height)
                    Box(
                        Modifier.offset {
                                IntOffset(
                                    pos.first.toInt() - 12.dp.roundToPx(),
                                    pos.second.toInt() - 12.dp.roundToPx(),
                                )
                            }
                            .size(24.dp)
                            .clickable {
                                reference.selectedPoint = index
                                reference.selectedSlot = -1
                            }
                    ) {
                        Canvas(Modifier.fillMaxSize()) {
                            drawCircle(
                                if (reference.selectedPoint == index) WebPalette.AccentSoft
                                else WebPalette.Success,
                                5.dp.toPx(),
                            )
                            drawCircle(
                                WebPalette.Background,
                                5.dp.toPx(),
                                style = Stroke(1.dp.toPx()),
                            )
                        }
                    }
                }
            }
        error?.let { Text(it, color = WebPalette.Danger, style = ShareTypography.context) }
    }
    LaunchedEffect(scene, model) { scene?.fitContents() }
}

package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.*
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
                                    put("elevation", -model.mountDepth)
                                    put("scale", 1)
                                    put("rotation", 0)
                                }
                            )
                        ),
                    )
            runCatching { normalizeMapDocument(content, listOf(model)) }.getOrDefault(content)
        }
    var fitted by remember(original.uuid) { mutableStateOf(false) }
    val guides =
        remember(model, reference.activeField, reference.selectedSlot) {
            mapModelGuides(model, reference.activeField, reference.selectedSlot)
        }
    val guideValue by rememberUpdatedState(guides)
    Box(Modifier.fillMaxWidth().height(340.dp)) {
        MapSceneView(
            document,
            listOf(model),
            cache,
            emptySet(),
            orbit = true,
            options = MapSceneOptions(automaticLod = false, streamAssets = false),
            tap = { pointer ->
                scene?.let { pickReferenceGuide(reference, guideValue, it, pointer) }
            },
            drag = { _, _ -> },
            cancel = {},
            renderer = { scene = it },
            status = { count, message ->
                error = message
                val current = scene
                if (
                    count == 0 &&
                        !fitted &&
                        current != null &&
                        current.width > 0 &&
                        current.hasMapFrame &&
                        current.readyRefs.isNotEmpty()
                ) {
                    fitted = true
                    current.fitContents(margin = .65)
                }
            },
        )
        if (fitted) scene?.let { MapReferenceGuideOverlay(reference, guides, it) }
        Row(Modifier.align(androidx.compose.ui.Alignment.TopEnd)) {
            MapToolButton("Вписать превью", Glyph.Maximize) { scene?.fitContents(margin = .65) }
        }
        error?.let { message ->
            Column(Modifier.align(androidx.compose.ui.Alignment.BottomStart)) {
                Text(message, color = WebPalette.Danger, style = ShareTypography.context)
                ShareTextButton({ scene?.retry() }) { Text("Повторить") }
            }
        }
    }
    androidx.compose.foundation.layout.FlowRow(
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        val portNames =
            listOf(
                "Север",
                "Северо-восток",
                "Восток",
                "Юго-восток",
                "Юг",
                "Юго-запад",
                "Запад",
                "Северо-запад",
            )
        for (marker in guides.markers.filter { it.kind == "port" }) ShareChoiceChip(
            marker.active,
            {
                reference.set(
                    "wallMask",
                    JsonPrimitive(
                        reference.currentDraft!!.current.number("wallMask").toInt() xor
                            (1 shl marker.index)
                    ),
                )
            },
            { Text(portNames[marker.index]) },
            modifier =
                Modifier.semantics { contentDescription = "Стык: ${portNames[marker.index]}" },
            enabled = !reference.saving,
        )
        model.supportSlots.indices.forEach { index ->
            ShareChoiceChip(
                reference.selectedSlot == index,
                {
                    reference.selectedSlot = index
                    reference.selectedPoint = -1
                },
                { Text("Паз ${index+1}") },
                modifier =
                    Modifier.semantics { contentDescription = "Выбрать паз ${index+1} в превью" },
            )
        }
    }
    LaunchedEffect(scene, guides) { scene?.guides(guides) }
}

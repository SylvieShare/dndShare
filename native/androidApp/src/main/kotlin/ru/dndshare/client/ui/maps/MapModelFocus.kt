package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapModelFields(workspace: MapEditorWorkspace, ref: MapEntityRef, images: ImageLoader) {
    val doc = workspace.map?.document ?: return
    val row = ref.row(doc) ?: return
    if (ref.kind == MapEntityKind.Object)
        MapInspectorSection("Размер") {
            MapRange(
                "Масштаб",
                row.number("scale", 1.0),
                .25,
                8.0,
                .05,
                {
                    workspace.selection.update(
                        MapEntityKind.Object,
                        ref.id,
                        "scale",
                        JsonPrimitive(it),
                        true,
                    )
                },
                workspace.controller::finishEdit,
            )
        }
    val area =
        doc.rows("areas").find {
            ref.id in it.ids(if (ref.kind == MapEntityKind.Tile) "tileIds" else "objectIds")
        }
    MapInspectorSection("Область") {
        if (area != null)
            MapEntityRow(workspace, MapEntityRef(MapEntityKind.Area, area.string("id")), images)
        ShareSelect(
            "Добавить в область",
            area?.string("id").orEmpty(),
            listOf("" to "Без области") +
                doc.rows("areas").map { it.string("id") to it.string("name") },
        ) { value ->
            workspace.controller.document { mapAssignArea(it, value.ifBlank { null }, setOf(ref)) }
        }
        ShareTextButton(workspace.selection::createArea) {
            AppGlyph(Glyph.Plus)
            Text("Создать область")
        }
    }
    MapModelTransitions(workspace, ref, images)
    val decals = doc.rows("decals").filter { mapAnchorRef(it["anchor"] as? JsonObject) == ref }
    MapInspectorSection("Декали (${decals.size})") {
        decals.forEach {
            MapEntityRow(workspace, MapEntityRef(MapEntityKind.Decal, it.string("id")), images)
        }
        ShareOutlinedButton({
            workspace.controller.ui {
                it.copy(panel = "decals", sidebarOpen = true, focusOpen = false)
            }
        }) {
            AppGlyph(Glyph.Plus)
            Text("Добавить декаль")
        }
    }
    val lights = doc.rows("lights").filter { mapAnchorRef(it["anchor"] as? JsonObject) == ref }
    MapInspectorSection("Свет (${lights.size})") {
        lights.forEach {
            MapEntityRow(workspace, MapEntityRef(MapEntityKind.Light, it.string("id")), images)
        }
    }
}

private data class TransitionChoice(val transition: MapTransition, val reason: String?)

@Composable
private fun MapModelTransitions(
    workspace: MapEditorWorkspace,
    ref: MapEntityRef,
    images: ImageLoader,
) {
    val doc = workspace.map?.document ?: return
    val models = workspace.models
    val transitions =
        remember(doc, models, ref) { mapTransitions(doc, models, ref.kind.wire, ref.id) }
    var choosing by remember(ref) { mutableStateOf<String?>(null) }
    val choices by
        produceState<List<TransitionChoice>?>(null, doc, models, ref) {
            value =
                withContext(Dispatchers.Default) {
                    transitions.map { edge ->
                        TransitionChoice(
                            edge,
                            if (edge.custom && edge.modelId == null) null
                            else
                                runCatching {
                                    mapApplyTransition(
                                        doc,
                                        models,
                                        ref.kind.wire,
                                        ref.id,
                                        edge.key,
                                    )
                                }
                                    .exceptionOrNull()
                                    ?.message,
                        )
                    }
                }
        }
    if (ref.kind == MapEntityKind.Tile || transitions.isNotEmpty())
        MapInspectorSection("Переходы") {
            if (choices == null) ShareSkeletonBlock(Modifier.fillMaxWidth(), 56.dp)
            choices.orEmpty().forEach { choice ->
                val edge = choice.transition
                val target = models.find { it.uuid == edge.modelId }
                Column {
                    Row {
                        ShareOutlinedButton(
                            {
                                if (edge.custom && edge.modelId == null) choosing = edge.id
                                else
                                    workspace.controller.document {
                                        mapApplyTransition(
                                            it,
                                            workspace.current.models,
                                            ref.kind.wire,
                                            ref.id,
                                            edge.key,
                                        )
                                    }
                            },
                            modifier = Modifier.weight(1f),
                            enabled = choice.reason == null,
                        ) {
                            AppGlyph(Glyph.Transfer, Modifier.size(16.dp))
                            Column {
                                Text(
                                    target?.name
                                        ?: if (edge.custom) "Выбрать тайл" else "Модель недоступна"
                                )
                                Text(
                                    if (edge.custom && edge.modelId == null) "Выбрать тайл"
                                    else edge.label,
                                    style = ShareTypography.context,
                                    color = WebPalette.AccentSoft,
                                )
                            }
                        }
                        if (edge.custom)
                            MapToolButton("Удалить кастомный переход", Glyph.Trash) {
                                workspace.controller.document {
                                    mapSetTransition(it, ref.id, edge.id, null)
                                }
                            }
                    }
                    choice.reason?.let {
                        Text(it, style = ShareTypography.context, color = WebPalette.TextMuted)
                    }
                }
            }
            val count =
                (ref.row(doc)?.get("transitions") as? JsonObject)?.rows("targets")?.size ?: 0
            if (ref.kind == MapEntityKind.Tile)
                ShareOutlinedButton(
                    {
                        var id = ""
                        if (
                            workspace.controller.document { current ->
                                mapSetTransition(current, ref.id, null, null).also {
                                    id =
                                        (ref.row(it)?.get("transitions") as? JsonObject)
                                            ?.rows("targets")
                                            ?.lastOrNull()
                                            ?.string("id")
                                            .orEmpty()
                                }
                            }
                        )
                            choosing = id
                    },
                    enabled = count < 32,
                ) {
                    AppGlyph(Glyph.Plus)
                    Text("Создать переход")
                }
        }
    choosing?.let { transitionId ->
        ShareWindow(
            onDismissRequest = { choosing = null },
            title = { Text("Выберите тайл") },
            scrollContent = false,
        ) {
            Box(Modifier.fillMaxWidth().height(640.dp)) {
                MapModelPalette(
                    workspace,
                    images,
                    objects = false,
                    choose = { model ->
                        if (
                            workspace.controller.document {
                                mapSetTransition(it, ref.id, transitionId, model.uuid)
                            }
                        )
                            choosing = null
                    },
                )
            }
        }
    }
}

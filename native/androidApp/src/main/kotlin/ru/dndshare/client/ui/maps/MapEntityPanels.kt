package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import coil3.ImageLoader
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapAreasList(workspace: MapEditorWorkspace, images: ImageLoader) {
    val doc = workspace.map?.document ?: return
    ShareOutlinedButton(workspace.selection::createArea, enabled = doc.rows("areas").size < 200) {
        AppGlyph(Glyph.Plus)
        Text("Создать область")
    }
    doc.rows("areas").forEach { row ->
        val ref = MapEntityRef(MapEntityKind.Area, row.string("id"))
        MapEntityRow(workspace, ref, images, select = { workspace.focus(ref) }) {
            MapToolButton(
                if (row.flag("hidden")) "Показать область" else "Скрыть область",
                if (row.flag("hidden")) Glyph.EyeOff else Glyph.Eye,
            ) {
                workspace.selection.update(
                    MapEntityKind.Area,
                    ref.id,
                    "hidden",
                    JsonPrimitive(!row.flag("hidden")),
                )
            }
        }
    }
    if (doc.rows("areas").isEmpty())
        Text("Областей пока нет.", style = ShareTypography.context, color = WebPalette.TextMuted)
}

@Composable
internal fun MapAreaFields(workspace: MapEditorWorkspace, id: String, images: ImageLoader) {
    val doc = workspace.map?.document ?: return
    val area = MapEntityRef(MapEntityKind.Area, id).row(doc) ?: return
    fun update(key: String, value: JsonElement, group: Boolean = false) =
        workspace.selection.update(MapEntityKind.Area, id, key, value, group)
    ShareTextInput(
        area.string("name"),
        { if (it.isNotBlank()) update("name", JsonPrimitive(it)) },
        "Название области",
    )
    ShareColorInput(
        area.string("color", "#8b5cf6"),
        { update("color", JsonPrimitive(it), true) },
        "Цвет области",
        finish = workspace.controller::finishEdit,
    )
    ShareToggle("Показывать область", !area.flag("hidden")) { update("hidden", JsonPrimitive(!it)) }
    ShareToggle("Покрыть область туманом", area.flag("fog")) { update("fog", JsonPrimitive(it)) }
    val refs =
        area.ids("tileIds").map { MapEntityRef(MapEntityKind.Tile, it) } +
            area.ids("objectIds").map { MapEntityRef(MapEntityKind.Object, it) } +
            doc.rows("lights")
                .filter {
                    it.string("areaId") == id ||
                        mapAnchorRef(it["anchor"] as? JsonObject)?.let { ref ->
                            ref.id in
                                area.ids(
                                    if (ref.kind == MapEntityKind.Tile) "tileIds" else "objectIds"
                                )
                        } == true
                }
                .map { MapEntityRef(MapEntityKind.Light, it.string("id")) }
    MapInspectorSection("Элементы области (${refs.size})") {
        if (refs.isEmpty())
            Text(
                "Область пуста. Выберите элементы на карте и добавьте их через блок «Область».",
                style = ShareTypography.context,
                color = WebPalette.TextMuted,
            )
        refs.forEach { ref ->
            MapEntityRow(workspace, ref, images) {
                if (ref.kind != MapEntityKind.Light)
                    MapToolButton("Убрать из области", Glyph.Minus) {
                        workspace.controller.document { mapAssignArea(it, null, setOf(ref)) }
                    }
            }
        }
    }
}

@Composable
internal fun MapDecalFields(workspace: MapEditorWorkspace, id: String, images: ImageLoader) {
    val decal =
        workspace.map?.document?.let { MapEntityRef(MapEntityKind.Decal, id).row(it) } ?: return
    MapInspectorSection("Изображение") {
        for ((key, label, range) in
            listOf(
                Triple("width", "Ширина", .05..8.0),
                Triple("height", "Высота", .05..8.0),
                Triple("rotation", "Поворот", 0.0..360.0),
                Triple("opacity", "Непрозрачность", 0.0..1.0),
                Triple("depth", "Глубина наложения", .01..2.0),
            )) {
            val step =
                when (key) {
                    "rotation" -> 1.0
                    "width",
                    "height" -> .05
                    else -> .01
                }
            MapRange(
                label,
                decal.number(key),
                range.start,
                range.endInclusive,
                step,
                {
                    workspace.selection.update(
                        MapEntityKind.Decal,
                        id,
                        key,
                        JsonPrimitive(it),
                        true,
                    )
                },
                workspace.controller::finishEdit,
            )
        }
        ShareColorInput(
            decal.string("color", "#ffffff"),
            {
                workspace.selection.update(
                    MapEntityKind.Decal,
                    id,
                    "color",
                    JsonPrimitive(it),
                    true,
                )
            },
            "Оттенок",
            finish = workspace.controller::finishEdit,
        )
        ShareOutlinedButton({ workspace.placement.tool(MapTool.MoveDecal(id)) }) {
            AppGlyph(Glyph.Sticker)
            Text("Переместить на поверхность")
        }
    }
    mapAnchorRef(decal["anchor"] as? JsonObject)?.let { ref ->
        MapInspectorSection("Поверхность") { MapEntityRow(workspace, ref, images) }
    }
}

@Composable
internal fun MapCamerasList(workspace: MapEditorWorkspace, images: ImageLoader) {
    val doc = workspace.map?.document ?: return
    ShareToggle("Показывать камеры", workspace.ui.showCameras) { v ->
        workspace.controller.ui { it.copy(showCameras = v) }
    }
    ShareOutlinedButton(
        {
            val scene = workspace.scene ?: return@ShareOutlinedButton
            var id = ""
            if (
                workspace.controller.document { current ->
                    newMapCamera(
                            current,
                            captureMapCamera(scene.camera(), scene.width, scene.height),
                        )
                        .also { id = it.rows("cameras").last().string("id") }
                }
            )
                workspace.focus(MapEntityRef(MapEntityKind.Camera, id))
        },
        enabled = doc.rows("cameras").size < 64,
    ) {
        AppGlyph(Glyph.Plus)
        Text("Добавить камеру")
    }
    doc.rows("cameras").forEach {
        MapEntityRow(
            workspace,
            MapEntityRef(MapEntityKind.Camera, it.string("id")),
            images,
            select = { workspace.focus(MapEntityRef(MapEntityKind.Camera, it.string("id"))) },
        )
    }
    if (doc.rows("cameras").isEmpty())
        Text("Камер пока нет.", style = ShareTypography.context, color = WebPalette.TextMuted)
}

@Composable
internal fun MapCameraFields(workspace: MapEditorWorkspace, id: String) {
    val row =
        workspace.map?.document?.let { MapEntityRef(MapEntityKind.Camera, id).row(it) } ?: return
    val view = row["view"]?.jsonObject ?: return
    ShareTextInput(
        row.string("name"),
        {
            if (it.isNotBlank())
                workspace.selection.update(MapEntityKind.Camera, id, "name", JsonPrimitive(it))
        },
        "Название камеры",
    )
    ShareOutlinedButton({ workspace.scene?.let { it.camera(mapCameraView(view, it.width)) } }) {
        AppGlyph(Glyph.Camera)
        Text("Вид с камеры")
    }
    ShareOutlinedButton({
        workspace.scene?.let { scene ->
            workspace.controller.document {
                mapReplace(
                    it,
                    "cameras",
                    row.with("view", captureMapCamera(scene.camera(), scene.width, scene.height)),
                )
            }
        }
    }) {
        AppGlyph(Glyph.Target)
        Text("Захватить текущий ракурс")
    }
    MapInspectorSection("Положение камеры") {
        MapRange(
            "Высота камеры",
            view.array("position").double(2),
            minOf(0.0, view.array("position").double(2)),
            maxOf(32.0, view.array("position").double(2)),
            .1,
            { value ->
                workspace.controller.beginEdit()
                workspace.controller.document { updateMapCamera(it, id, "height", value) }
            },
            workspace.controller::finishEdit,
        )
    }
    MapInspectorSection("Кадр") {
        MapRange(
            "Ширина кадра, клеток",
            view.number("width", 1.0),
            .5,
            maxOf(300.0, view.number("width", 1.0)),
            .1,
            { value ->
                workspace.controller.beginEdit()
                workspace.controller.document { updateMapCamera(it, id, "width", value) }
            },
            workspace.controller::finishEdit,
        )
    }
}

package ru.dndshare.client.ui.maps

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapCanvasToolbar(workspace: MapEditorWorkspace, modifier: Modifier = Modifier) {
    Column(modifier.widthIn(max = 310.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (workspace.editable)
            Surface(color = WebPalette.Popover, shape = MaterialTheme.shapes.medium) {
                Row(Modifier.horizontalScroll(rememberScrollState())) {
                    MapToolButton(
                        if (workspace.ui.multiple) "Одиночный выбор" else "Множественный выбор",
                        Glyph.Group,
                    ) {
                        workspace.controller.ui { it.copy(multiple = !it.multiple) }
                    }
                    MapToolButton(
                        if (workspace.ui.rectangle) "Отменить выделение рамкой"
                        else "Выделить рамкой",
                        Glyph.Rectangle,
                    ) {
                        workspace.placement.cancelPreview()
                        workspace.controller.ui {
                            it.copy(rectangle = !it.rectangle, tool = MapTool.None)
                        }
                    }
                    if (workspace.ui.focus.selected.isNotEmpty()) {
                        MapToolButton("Повернуть выбор", Glyph.Rotate) {
                            workspace.selection.rotate()
                        }
                        MapToolButton("Отразить выбор", Glyph.Flip) {
                            workspace.selection.rotate(mirror = true)
                        }
                        MapToolButton(
                            "Копировать выбор",
                            Glyph.Copy,
                            run = workspace.selection::copy,
                        )
                        MapToolButton(
                            "Удалить выбор",
                            Glyph.Trash,
                            run = workspace.selection::remove,
                        )
                    }
                    if (workspace.ui.clipboard != null)
                        MapToolButton("Вставить", Glyph.Clipboard, run = workspace.selection::paste)
                }
            }
        if (workspace.currentUi.tool != MapTool.None)
            Surface(color = WebPalette.Popover, shape = MaterialTheme.shapes.medium) {
                Column {
                    val activeTool = workspace.ui.tool
                    val activeModel =
                        (activeTool as? MapTool.Model)?.let { tool ->
                            workspace.models.find { it.uuid == tool.modelId }
                        }
                    val rotate =
                        activeTool is MapTool.Model ||
                            activeTool is MapTool.Paste ||
                            activeTool is MapTool.Decal
                    val mirror =
                        activeTool is MapTool.Paste ||
                            activeTool is MapTool.Model && activeModel?.isObject == false
                    Row {
                        if (rotate)
                            MapToolButton("Повернуть", Glyph.Rotate) {
                                workspace.selection.rotate()
                            }
                        if (mirror)
                            MapToolButton("Отразить", Glyph.Flip) {
                                workspace.selection.rotate(mirror = true)
                            }
                        MapToolButton("Отменить размещение", Glyph.Close) {
                            workspace.placement.cancel()
                        }
                    }
                    val model =
                        (workspace.ui.tool as? MapTool.Model)?.let { tool ->
                            workspace.models.find { it.uuid == tool.modelId }
                        }
                    if (model != null && !model.isObject && model.width == 1 && model.height == 1)
                        ShareToggle("Заливка замкнутой области", workspace.ui.fillRoom) { value ->
                            workspace.controller.ui { it.copy(fillRoom = value) }
                            workspace.placement.refreshPreview()
                        }
                    if (activeTool !is MapTool.BindLight && activeTool !is MapTool.MoveDecal)
                        ShareToggle("Повторять размещение", workspace.ui.repeatPlacement) { v ->
                            workspace.controller.ui { it.copy(repeatPlacement = v) }
                        }
                }
            }
        workspace.map?.let { MapViewerTools(workspace.scene, it.document) }
        ShareTextButton({ workspace.controller.ui { it.copy(orbit = !it.orbit) } }) {
            AppGlyph(Glyph.Transfer)
            Text(
                if (workspace.ui.orbit) "Перемещать камеру" else "Вращать камеру",
                style = ShareTypography.context,
            )
        }
        if (workspace.modelPending > 0) ShareBadge("Загружаем модели: ${workspace.modelPending}")
        workspace.hint?.let { ShareBadge(it) }
    }
}

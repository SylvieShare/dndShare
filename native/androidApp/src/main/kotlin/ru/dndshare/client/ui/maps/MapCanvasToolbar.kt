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
                        workspace.controller.ui { it.copy(rectangle = !it.rectangle) }
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
                    Row {
                        MapToolButton("Повернуть", Glyph.Rotate) { workspace.selection.rotate() }
                        MapToolButton("Отразить", Glyph.Flip) {
                            workspace.selection.rotate(mirror = true)
                        }
                        MapToolButton("Отменить размещение", Glyph.Close) {
                            workspace.placement.cancel()
                        }
                    }
                    Row {
                        MapToolButton("Уровень ниже", Glyph.Down, workspace.ui.level > 0) {
                            workspace.controller.ui {
                                it.copy(level = (it.level - 1).coerceAtLeast(0))
                            }
                            workspace.placement.refreshPreview()
                        }
                        Text("Уровень ${workspace.ui.level}", style = ShareTypography.context)
                        MapToolButton("Уровень выше", Glyph.Up, workspace.ui.level < 15) {
                            workspace.controller.ui {
                                it.copy(level = (it.level + 1).coerceAtMost(15))
                            }
                            workspace.placement.refreshPreview()
                        }
                    }
                    ShareToggle("Повторять размещение", workspace.ui.repeatPlacement) { v ->
                        workspace.controller.ui { it.copy(repeatPlacement = v) }
                    }
                }
            }
        Surface(
            color = WebPalette.Surface.copy(alpha = .94f),
            shape = MaterialTheme.shapes.medium,
        ) {
            Row {
                MapToolButton("Приблизить", Glyph.Plus) { zoom(workspace, 1.2) }
                MapToolButton("Отдалить", Glyph.Minus) { zoom(workspace, 1 / 1.2) }
                MapToolButton("Вписать карту", Glyph.Target) {
                    workspace.scene?.let { scene ->
                        workspace.current.map?.let { map ->
                            scene.camera(
                                scene
                                    .camera()
                                    .fit(
                                        map.document.number("width"),
                                        map.document.number("height"),
                                        scene.width,
                                        scene.height,
                                    )
                            )
                        }
                    }
                }
                MapToolButton(
                    if (workspace.ui.orbit) "Перемещать камеру" else "Вращать камеру",
                    Glyph.Transfer,
                ) {
                    workspace.controller.ui { it.copy(orbit = !it.orbit) }
                }
            }
        }
        if (workspace.modelPending > 0) ShareBadge("Загружаем модели: ${workspace.modelPending}")
        workspace.hint?.let { ShareBadge(it) }
    }
}

private fun zoom(workspace: MapEditorWorkspace, amount: Double) {
    workspace.scene?.let { scene ->
        scene.camera(
            scene
                .camera()
                .zoom(amount, scene.width / 2.0, scene.height / 2.0, scene.width, scene.height)
        )
    }
}

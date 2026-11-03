package ru.dndshare.client.ui.maps

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapEditorLayout(
    workspace: MapEditorWorkspace,
    cache: MapAssetCache,
    images: ImageLoader,
    admin: Boolean,
    leaving: Boolean,
    exit: () -> Unit,
) {
    if (workspace.referenceOpen && admin) MapReferenceWindow(workspace, cache, images)
    val state = workspace.state
    val map = state.map
    val overlayLeft by
        animateDpAsState(if (workspace.sidebarOpen) 273.dp else 0.dp, label = "Map tools inset")
    Column(Modifier.fillMaxSize().background(WebPalette.Background).imePadding()) {
        Box(Modifier.windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top))) {
            ShareWorkspaceHeader(
                contentInset = 12.dp,
                maxContentWidth = 5000.dp,
                actions = {
                    if (admin && map?.editable == true)
                        MapToolButton("Справочник моделей", Glyph.Book) {
                            workspace.referenceOpen = true
                        }
                    if (state.saving) Text("Сохраняем…", style = ShareTypography.context)
                    else if (state.work?.dirty == true)
                        Text(
                            "Есть правки",
                            style = ShareTypography.context,
                            color = WebPalette.AccentSoft,
                        )
                    if (map?.editable == true) {
                        MapToolButton(
                            "Отменить",
                            Glyph.Undo,
                            state.work?.undo?.isNotEmpty() == true && !state.conflict,
                            workspace.controller::undo,
                        )
                        MapToolButton(
                            "Повторить",
                            Glyph.Redo,
                            state.work?.redo?.isNotEmpty() == true && !state.conflict,
                            workspace.controller::redo,
                        )
                    }
                },
            ) {
                MapToolButton("К картам", Glyph.Back, !leaving, exit)
                Column(Modifier.weight(1f)) {
                    Text(
                        map?.name ?: "Редактор карты",
                        maxLines = 1,
                        style = ShareTypography.header,
                    )
                    if (map?.publishedAt != null)
                        Text(
                            "Опубликованная карта · ${map.author}",
                            style = ShareTypography.context,
                        )
                }
            }
        }
        val error = state.error ?: workspace.rendererError
        if (error != null)
            Row(
                Modifier.fillMaxWidth().background(WebPalette.Subheader).padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    error,
                    Modifier.weight(1f),
                    color = WebPalette.Danger,
                    style = ShareTypography.context,
                )
                ShareTextButton({
                    workspace.rendererError = null
                    workspace.scene?.retry()
                    if (state.work == null) workspace.controller.open(workspace.id)
                    else workspace.controller.retry()
                }) {
                    Text(if (state.work == null) "Повторить загрузку" else "Повторить")
                }
            }
        if (map == null) {
            if (state.loading)
                Column(
                    Modifier.fillMaxSize().padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    ShareSkeletonBlock(Modifier.fillMaxWidth(.45f), 48.dp)
                    ShareSkeletonBlock(Modifier.fillMaxSize(), 240.dp)
                }
            else
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text("Не удалось открыть карту", style = ShareTypography.header)
                }
        } else
            BoxWithConstraints(Modifier.fillMaxWidth().weight(1f)) {
                Row(Modifier.fillMaxSize()) {
                    if (map.editable)
                        MapToolRail(
                            if (workspace.sidebarOpen) workspace.ui.panel else "",
                            workspace::panel,
                            Modifier.width(77.dp),
                        )
                    Box(
                        Modifier.weight(1f).fillMaxHeight().onGloballyPositioned {
                            workspace.canvasBounds = it.boundsInRoot()
                        }
                    ) {
                        MapSceneView(
                            workspace.preview ?: map.document,
                            workspace.models,
                            cache,
                            workspace.ui.focus.selected.toSet(),
                            workspace.ui.orbit,
                            tap = workspace.placement::tap,
                            drag = { pointer, end ->
                                if (workspace.currentUi.tool != MapTool.None) {
                                    workspace.placement.preview(pointer)
                                    if (end) workspace.placement.tap(pointer)
                                } else workspace.drag.move(pointer, end)
                            },
                            cancel = {
                                workspace.rectangle.cancel()
                                workspace.drag.cancel()
                                workspace.placement.cancelPreview()
                            },
                            renderer = workspace::attachScene,
                            initialCamera = workspace.ui.camera,
                            active = !workspace.referenceOpen,
                            placing = workspace.ui.tool != MapTool.None,
                            options =
                                MapSceneOptions(
                                    forceLod = workspace.ui.forceLod,
                                    preview = workspace.previewSpec,
                                    previewValid = workspace.previewValid,
                                    selectedLight =
                                        workspace.ui.focus.selected
                                            .firstOrNull { it.kind == MapEntityKind.Light }
                                            ?.id,
                                ),
                            rectangle = workspace.ui.rectangle,
                            selection = workspace.rectangle::move,
                            key = workspace::key,
                            status = { pending, message ->
                                workspace.modelPending = pending
                                if (message != null) workspace.rendererError = message
                            },
                        )
                        MapEditorAnnotations(workspace)
                        workspace.rectangle.bounds?.let { rect ->
                            Canvas(Modifier.fillMaxSize()) {
                                drawRect(
                                    WebPalette.Accent.copy(alpha = .15f),
                                    rect.topLeft,
                                    rect.size,
                                )
                                drawRect(
                                    WebPalette.AccentSoft,
                                    rect.topLeft,
                                    rect.size,
                                    style = Stroke(1.dp.toPx()),
                                )
                            }
                        }
                        if (state.modelLoading && workspace.models.isEmpty())
                            ShareSkeletonBlock(Modifier.fillMaxSize())
                        MapCanvasToolbar(
                            workspace,
                            Modifier.align(Alignment.BottomStart)
                                .padding(
                                    start = overlayLeft + 12.dp,
                                    top = 12.dp,
                                    end = 12.dp,
                                    bottom = 12.dp,
                                )
                                .windowInsetsPadding(
                                    WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom)
                                ),
                        )
                        val selected =
                            workspace.ui.focus.entity?.let(::setOf)
                                ?: workspace.ui.focus.selected.toSet()
                        androidx.compose.animation.AnimatedVisibility(
                            map.editable && workspace.ui.focusOpen && selected.isNotEmpty(),
                            Modifier.align(Alignment.TopEnd),
                            enter = fadeIn() + slideInHorizontally { it / 4 },
                            exit = fadeOut() + slideOutHorizontally { it / 4 },
                        ) {
                            Surface(
                                Modifier.padding(12.dp)
                                    .width(
                                        350.dp.coerceAtMost(
                                            this@BoxWithConstraints.maxWidth - 101.dp
                                        )
                                    )
                                    .heightIn(
                                        max =
                                            (this@BoxWithConstraints.maxHeight - 24.dp)
                                                .coerceAtLeast(1.dp)
                                    ),
                                color = WebPalette.Surface,
                                shape = MaterialTheme.shapes.large,
                            ) {
                                MapSelectionInspector(workspace, images)
                            }
                        }
                    }
                }
                androidx.compose.animation.AnimatedVisibility(
                    map.editable && workspace.sidebarOpen,
                    enter = fadeIn() + slideInHorizontally { -it / 3 },
                    exit = fadeOut() + slideOutHorizontally { -it / 3 },
                ) {
                    Surface(
                        Modifier.padding(start = 77.dp)
                            .width(273.dp.coerceAtMost(this@BoxWithConstraints.maxWidth - 77.dp))
                            .fillMaxHeight(),
                        color = WebPalette.Surface,
                    ) {
                        MapEditorPanel(workspace, images)
                    }
                }
            }
    }
}

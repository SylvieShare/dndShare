package ru.dndshare.client.ui.maps

import androidx.compose.runtime.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collect
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.ui.LayoutFormat

/** Commands read the latest controller state; Compose observes one immutable snapshot. */
@Stable
internal class MapEditorWorkspace(
    val controller: MapEditorController,
    parentScope: CoroutineScope,
    initialFormat: LayoutFormat,
    val id: String,
    val api: MapsApi,
    val snapshots: MapSnapshotQueue,
) {
    val scope =
        CoroutineScope(
            parentScope.coroutineContext + SupervisorJob(parentScope.coroutineContext[Job])
        )
    var state by mutableStateOf(controller.state.value)
        private set

    var format by mutableStateOf(initialFormat)
    var scene by mutableStateOf<FilamentMapScene?>(null)
    var preview by mutableStateOf<kotlinx.serialization.json.JsonObject?>(null)
    var hint by mutableStateOf<String?>(null)
    var previewValid by mutableStateOf(true)
    var decalImages by mutableStateOf<List<MapDecalImage>?>(null)
    var decalError by mutableStateOf<String?>(null)
    var decalUploading by mutableStateOf(false)
    var modelPending by mutableIntStateOf(0)
    var rendererError by mutableStateOf<String?>(null)
    val map
        get() = state.map

    val ui
        get() = state.work?.ui ?: MapEditorUi()

    val models
        get() = state.models

    val current
        get() = controller.state.value

    val currentUi
        get() = current.work?.ui ?: MapEditorUi()

    val editable
        get() = current.map?.editable == true && !current.conflict

    val sidebarOpen
        get() = ui.sidebarOpen ?: (format == LayoutFormat.Wide)

    var canvasBounds by mutableStateOf(androidx.compose.ui.geometry.Rect.Zero)
    private val viewport = MapViewportSession(controller, scope)

    fun attachScene(value: FilamentMapScene?) {
        scene = value
        viewport.attach(value)
    }

    val cameraDrag = MapCameraDrag(this)
    val rectangle = MapRectangleSelection(this)
    val paletteDrag = MapPaletteDrag(this)
    var referenceOpen: Boolean
        get() = ui.referenceOpen
        set(value) {
            controller.ui { it.copy(referenceOpen = value) }
        }

    val reference = MapReferenceController(this)
    val selection = MapSelectionCommands(this)
    val placement = MapPlacementCommands(this)
    val drag = MapDragCommands(this)
    private val observation =
        scope.launch(start = CoroutineStart.UNDISPATCHED) {
            controller.state.collect { state = it }
        }

    fun panel(key: String) {
        placement.cancelPreview()
        controller.ui { value ->
            value.copy(
                panel = key,
                sidebarOpen =
                    value.panel != key || !(value.sidebarOpen ?: (format == LayoutFormat.Wide)),
                focusOpen = if (format == LayoutFormat.Wide) value.focusOpen else false,
                tool = MapTool.None,
            )
        }
    }

    fun focus(ref: MapEntityRef, push: Boolean = false) {
        focus(
            MapFocus(
                if (ref.kind in setOf(MapEntityKind.Area, MapEntityKind.Camera)) emptyList()
                else listOf(ref),
                if (ref.kind in setOf(MapEntityKind.Area, MapEntityKind.Camera)) ref else null,
            ),
            push,
        )
    }

    fun focus(value: MapFocus, push: Boolean = false) {
        placement.cancelPreview()
        controller.ui { ui ->
            ui.copy(
                focus = value,
                focusOpen = true,
                back = if (push) (ui.back + ui.focus).takeLast(12) else emptyList(),
                sidebarOpen = if (format == LayoutFormat.Wide) ui.sidebarOpen else false,
                tool = MapTool.None,
            )
        }
    }

    fun select(ref: MapEntityRef?) {
        controller.ui { ui ->
            val selected =
                when {
                    !ui.multiple -> listOfNotNull(ref)
                    ref == null -> ui.focus.selected
                    ref in ui.focus.selected -> ui.focus.selected - ref
                    else -> ui.focus.selected + ref
                }
            ui.copy(
                focus = MapFocus(selected),
                back = emptyList(),
                focusOpen = true,
                sidebarOpen = if (format == LayoutFormat.Wide) ui.sidebarOpen else false,
            )
        }
    }

    fun clearFocus() {
        controller.ui { it.copy(focus = MapFocus(), back = emptyList()) }
    }

    fun back(): Boolean {
        val ui = currentUi
        when {
            referenceOpen -> reference.request { referenceOpen = false }
            rectangle.bounds != null -> rectangle.cancel()
            ui.rectangle -> controller.ui { it.copy(rectangle = false) }
            drag.active -> drag.cancel()
            ui.tool != MapTool.None -> placement.cancel()
            preview != null -> placement.cancelPreview()
            ui.back.isNotEmpty() ->
                controller.ui { it.copy(focus = it.back.last(), back = it.back.dropLast(1)) }
            ui.focus.entity != null || ui.focus.selected.isNotEmpty() -> clearFocus()
            ui.sidebarOpen ?: (format == LayoutFormat.Wide) ->
                controller.ui { it.copy(sidebarOpen = false) }
            else -> return false
        }
        return true
    }

    fun close() {
        viewport.close()
        cameraDrag.cancel()
        paletteDrag.cancel()
        rectangle.cancel()
        drag.close()
        placement.close()
        observation.cancel()
        scope.cancel()
    }
}

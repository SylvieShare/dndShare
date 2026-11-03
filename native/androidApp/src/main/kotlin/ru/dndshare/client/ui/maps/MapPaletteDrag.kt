package ru.dndshare.client.ui.maps

import androidx.compose.runtime.*
import androidx.compose.ui.geometry.Offset
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.LayoutFormat

/** One drag owner; palette coordinates and the SurfaceView are measured in the same root. */
internal class MapPaletteDrag(private val workspace: MapEditorWorkspace) {
    var active by mutableStateOf(false)
        private set

    private var point: MapPointer? = null

    fun start(model: MapModel) = start(MapTool.Model(model.uuid))

    fun start(tool: MapTool) {
        if (!workspace.editable) return
        active = true
        workspace.placement.tool(tool, keepSidebar = true)
    }

    fun move(root: Offset) {
        if (!active) return
        val bounds = workspace.canvasBounds
        val scene = workspace.scene ?: return
        val x = root.x - bounds.left
        val y = root.y - bounds.top
        val clearLeft = if (workspace.sidebarOpen) 273 * scene.density else 0f
        if (x < clearLeft || x >= bounds.width || y !in 0f..bounds.height) {
            point = null
            workspace.placement.cancelPreview()
            return
        }
        val next =
            MapPointer(
                null,
                scene.camera().world(x.toDouble(), y.toDouble(), scene.width, scene.height),
                x,
                y,
            )
        point = next
        workspace.placement.preview(next)
    }

    fun end() {
        if (!active) return
        active = false
        val last = point
        point = null
        if (last != null) workspace.placement.tap(last) else workspace.placement.cancel()
        if (workspace.format != LayoutFormat.Wide)
            workspace.controller.ui { it.copy(sidebarOpen = false) }
    }

    fun cancel() {
        if (active) {
            active = false
            point = null
            workspace.placement.cancel()
        }
    }
}

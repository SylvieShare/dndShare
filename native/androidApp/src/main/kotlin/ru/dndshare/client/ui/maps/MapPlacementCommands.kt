package ru.dndshare.client.ui.maps

import java.util.UUID
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.LayoutFormat

/** One coalesced preview worker and serial commit queue keep geometry calculation off Compose. */
internal class MapPlacementCommands(private val workspace: MapEditorWorkspace) {
    private data class Request(
        val serial: Long,
        val document: JsonObject,
        val models: List<MapModel>,
        val tool: MapTool,
        val rotation: Int,
        val mirrored: Boolean,
        val fill: Boolean,
        val pointer: MapPointer,
        val view: MapPlacementView?,
    )

    private val controller
        get() = workspace.controller

    private val previews = Channel<Request>(Channel.CONFLATED)
    private val commits = Mutex()
    private val surfaces = MapSurfacePlacement(workspace)
    private var sequence = 0L
    private var last: MapPointer? = null
    private val worker =
        workspace.scope.launch {
            for (request in previews) {
                val result =
                    withContext(Dispatchers.Default) { runCatching { calculate(request, true) } }
                if (request.serial != sequence || workspace.currentUi.tool != request.tool) continue
                result
                    .onSuccess {
                        workspace.showPreview(it.document, it.selected, moving = false)
                        workspace.previewValid = true
                        workspace.hint = null
                    }
                    .onFailure {
                        workspace.preview = null
                        workspace.previewValid = false
                        workspace.hint = it.message
                    }
            }
        }

    fun tool(value: MapTool, keepSidebar: Boolean = false) {
        cancelPreview()
        controller.ui {
            it.copy(
                tool = value,
                rectangle = false,
                fillRoom =
                    it.fillRoom &&
                        (value as? MapTool.Model)?.let { tool ->
                            workspace.current.models
                                .find { it.uuid == tool.modelId }
                                ?.let { model ->
                                    !model.isObject && model.width == 1 && model.height == 1
                                }
                        } == true,
                focus =
                    if (value is MapTool.BindLight || value is MapTool.MoveDecal) it.focus
                    else MapFocus(),
                back = emptyList(),
                focusOpen = value is MapTool.BindLight || value is MapTool.MoveDecal,
                sidebarOpen =
                    if (keepSidebar || workspace.format == LayoutFormat.Wide) it.sidebarOpen
                    else false,
            )
        }
    }

    fun cancelPreview() {
        sequence++
        surfaces.cancel()
        workspace.preview = null
        workspace.hint = null
        workspace.previewValid = true
        last = null
    }

    fun cancel() {
        cancelPreview()
        controller.ui { it.copy(tool = MapTool.None) }
    }

    fun close() {
        cancelPreview()
        previews.close()
        worker.cancel()
    }

    fun refreshPreview() {
        last?.let(::preview)
    }

    private fun request(pointer: MapPointer, tool: MapTool = workspace.currentUi.tool): Request? {
        val map = workspace.current.map ?: return null
        val ui = workspace.currentUi
        val scene = workspace.scene
        val view =
            scene
                ?.takeIf { it.width > 0 && it.height > 0 }
                ?.let {
                    MapPlacementView(
                        it.camera(),
                        pointer.x.toDouble(),
                        pointer.y.toDouble(),
                        it.width,
                        it.height,
                    )
                }
        return Request(
            sequence,
            map.document,
            workspace.current.models,
            tool,
            ui.rotation,
            ui.mirrored,
            ui.fillRoom,
            pointer,
            view,
        )
    }

    fun preview(pointer: MapPointer) {
        last = pointer
        val tool = workspace.currentUi.tool
        if (
            tool == MapTool.None ||
                tool is MapTool.Decal ||
                tool is MapTool.MoveDecal ||
                tool is MapTool.BindLight
        )
            return
        sequence++
        request(pointer, tool)?.let { previews.trySend(it) }
    }

    private fun calculate(request: Request, preview: Boolean): MapPlacementBuild {
        fun id(ref: MapEntityRef) =
            if (preview) "preview-${ref.kind.wire}-${ref.id}" else UUID.randomUUID().toString()
        val built =
            buildMapPlacement(
                request.document,
                request.models,
                request.tool,
                request.rotation,
                request.mirrored,
                request.pointer.world,
                request.view,
                request.fill,
                ::id,
            )
        if (!preview) return built
        val stable =
            built.document.rows("lights").map { light ->
                val anchor = mapAnchorRef(light["anchor"] as? JsonObject)
                if (
                    anchor?.id?.startsWith("preview-") == true &&
                        light.string("builtinKey").isNotBlank()
                )
                    light.with(
                        "id",
                        JsonPrimitive("preview-light-${anchor.key}-${light.string("builtinKey")}"),
                    )
                else light
            }
        return built.copy(document = built.document.with("lights", JsonArray(stable)))
    }

    fun tap(pointer: MapPointer) {
        val tool = workspace.currentUi.tool
        if (tool == MapTool.None) {
            workspace.select(pointer.hit)
            return
        }
        if (!workspace.editable) return
        when (tool) {
            is MapTool.BindLight -> {
                val hit = pointer.hit ?: return
                if (hit.kind !in setOf(MapEntityKind.Tile, MapEntityKind.Object)) return
                if (
                    controller.document {
                        mapBindLight(
                            it,
                            workspace.current.models,
                            tool.id,
                            buildJsonObject {
                                put("kind", hit.kind.wire)
                                put("id", hit.id)
                            },
                        )
                    }
                )
                    workspace.focus(MapEntityRef(MapEntityKind.Light, tool.id))
            }
            is MapTool.Decal,
            is MapTool.MoveDecal -> surfaces.place(pointer, tool)
            else -> {
                sequence++
                workspace.scope.launch {
                    commits.withLock {
                        repeat(3) {
                            if (!workspace.editable || workspace.currentUi.tool != tool)
                                return@withLock
                            val snapshot = request(pointer, tool) ?: return@withLock
                            val calculated =
                                withContext(Dispatchers.Default) {
                                    runCatching { calculate(snapshot, false) }
                                }
                            val result = calculated.getOrElse {
                                controller.notice(it.message)
                                return@withLock
                            }
                            if (
                                workspace.current.map?.document != snapshot.document ||
                                    workspace.current.models !== snapshot.models
                            )
                                return@repeat
                            val accepted = controller.document { result.document }
                            if (accepted) {
                                workspace.preview = null
                                if (workspace.currentUi.repeatPlacement) preview(pointer)
                                else workspace.focus(MapFocus(result.selected.toList()))
                            }
                            return@withLock
                        }
                        controller.notice(
                            "Карта изменилась во время размещения. Повторите действие."
                        )
                    }
                }
            }
        }
    }
}

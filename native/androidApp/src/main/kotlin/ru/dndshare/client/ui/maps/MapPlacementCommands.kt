package ru.dndshare.client.ui.maps

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.LayoutFormat

internal class MapPlacementCommands(private val workspace: MapEditorWorkspace) {
    private val controller
        get() = workspace.controller

    private var sequence = 0L
    private var last: MapPointer? = null

    fun tool(value: MapTool, keepSidebar: Boolean = false) {
        cancelPreview()
        controller.ui {
            it.copy(
                tool = value,
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
        workspace.preview = null
        workspace.hint = null
        workspace.previewValid = true
        last = null
    }

    fun cancel() {
        cancelPreview()
        controller.ui { it.copy(tool = MapTool.None) }
    }

    fun close() = cancelPreview()

    fun refreshPreview() {
        last?.let(::preview)
    }

    fun preview(pointer: MapPointer) {
        last = pointer
        val current = workspace.current
        val map = current.map ?: return
        val tool = workspace.currentUi.tool
        if (tool == MapTool.None) return
        if (tool is MapTool.Decal || tool is MapTool.MoveDecal || tool is MapTool.BindLight) return
        runCatching { build(map.document, tool, pointer.world, true) }
            .onSuccess {
                workspace.preview = it.first
                workspace.previewValid = true
                workspace.hint = null
            }
            .onFailure {
                workspace.preview = null
                workspace.previewValid = false
                workspace.hint = it.message
            }
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
                    controller.document { doc ->
                        mapBindLight(
                            doc,
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
            is MapTool.MoveDecal -> surface(pointer, tool)
            else -> {
                var selected = emptySet<MapEntityRef>()
                val accepted = controller.document { doc ->
                    build(doc, tool, pointer.world, false).let { (next, refs) ->
                        selected = refs
                        next
                    }
                }
                if (accepted) {
                    workspace.preview = null
                    if (workspace.currentUi.repeatPlacement) preview(pointer)
                    else workspace.focus(MapFocus(selected.toList()))
                }
            }
        }
    }

    private fun surface(pointer: MapPointer, tool: MapTool) {
        val request = ++sequence
        val scene = workspace.scene ?: return
        workspace.hint = "Выбираем поверхность…"
        scene.pickSurface(pointer.x, pointer.y) { hit ->
            if (request != sequence || workspace.currentUi.tool != tool) return@pickSurface
            workspace.hint = null
            if (hit == null) {
                controller.notice("Выберите поверхность плитки или объекта")
                return@pickSurface
            }
            var id = ""
            val accepted = controller.document { doc ->
                val owner = requireNotNull(hit.owner.row(doc)) { "Опора уже удалена" }
                require(owner.string("modelId") == hit.modelId) {
                    "Модель опоры изменилась; выберите поверхность ещё раз"
                }
                val anchor = buildJsonObject {
                    put("kind", hit.owner.kind.wire)
                    put("id", hit.owner.id)
                }
                when (tool) {
                    is MapTool.Decal -> {
                        val row =
                            newMapDecal(
                                tool.image,
                                hit.owner.kind.wire,
                                hit.owner.id,
                                hit.local,
                                hit.normal,
                            )
                        id = row.string("id")
                        doc.with("decals", JsonArray(doc.rows("decals") + row))
                    }
                    is MapTool.MoveDecal -> {
                        id = tool.id
                        val row = requireNotNull(MapEntityRef(MapEntityKind.Decal, id).row(doc))
                        mapReplace(
                            doc,
                            "decals",
                            row.with("anchor", anchor)
                                .with(
                                    "position",
                                    numbers(
                                        hit.local.x.toDouble(),
                                        hit.local.y.toDouble(),
                                        hit.local.z.toDouble(),
                                    ),
                                )
                                .with(
                                    "normal",
                                    numbers(
                                        hit.normal.x.toDouble(),
                                        hit.normal.y.toDouble(),
                                        hit.normal.z.toDouble(),
                                    ),
                                ),
                        )
                    }
                    else -> doc
                }
            }
            if (accepted) workspace.focus(MapEntityRef(MapEntityKind.Decal, id))
        }
    }

    private fun build(
        document: JsonObject,
        tool: MapTool,
        point: MapPose,
        preview: Boolean,
    ): Pair<JsonObject, Set<MapEntityRef>> {
        val ui = workspace.currentUi
        val catalogue = workspace.current.models
        val models = catalogue.associateBy { it.uuid }
        fun id(ref: MapEntityRef) =
            if (preview) "preview-${ref.kind.wire}-${ref.id}" else UUID.randomUUID().toString()
        val result =
            when (tool) {
                is MapTool.Model -> {
                    val model = requireNotNull(models[tool.modelId]) { "Модель недоступна" }
                    val kind = if (model.isObject) MapEntityKind.Object else MapEntityKind.Tile
                    val key = id(MapEntityRef(kind, "model"))
                    val next =
                        if (model.isObject)
                            mapPlaceObject(document, model, models, point, ui.rotation, key)
                        else
                            mapPlaceTile(
                                document,
                                model,
                                point,
                                ui.rotation,
                                ui.level,
                                key,
                                ui.mirrored,
                            )
                    next to setOf(MapEntityRef(kind, key))
                }
                is MapTool.Light -> {
                    require(
                        document.rows("lights").count { it.string("builtinKey").isBlank() } < 32
                    ) {
                        "Не более 32 ручных источников"
                    }
                    require(
                        point.x in 0.0..document.number("width") &&
                            point.y in 0.0..document.number("height")
                    ) {
                        "Источник должен находиться на карте"
                    }
                    val key = id(MapEntityRef(MapEntityKind.Light, "source"))
                    val source = newMapLight(tool.preset, point).with("id", JsonPrimitive(key))
                    document.with("lights", JsonArray(document.rows("lights") + source)) to
                        setOf(MapEntityRef(MapEntityKind.Light, key))
                }
                is MapTool.Paste ->
                    mapPaste(document, catalogue, tool.payload, point, ui.level, ::id, tool.pivot)
                else -> document to emptySet()
            }
        mapPlacements(result.first, models)
        var next = normalizeMapDocument(result.first, catalogue)
        if (preview)
            next =
                next.with(
                    "lights",
                    JsonArray(
                        next.rows("lights").map { source ->
                            val anchor = mapAnchorRef(source["anchor"] as? JsonObject)
                            if (
                                anchor?.id?.startsWith("preview-") == true &&
                                    source.string("builtinKey").isNotBlank()
                            )
                                source.with(
                                    "id",
                                    JsonPrimitive(
                                        "preview-light-${anchor.key}-${source.string("builtinKey")}"
                                    ),
                                )
                            else source
                        }
                    ),
                )
        return next to result.second
    }
}

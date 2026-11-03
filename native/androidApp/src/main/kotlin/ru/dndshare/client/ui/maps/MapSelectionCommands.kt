package ru.dndshare.client.ui.maps

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*

internal class MapSelectionCommands(private val workspace: MapEditorWorkspace) {
    private val controller
        get() = workspace.controller

    private var rotationRows: List<JsonObject>? = null
    private var pivot: MapPose? = null

    fun remove() {
        val ui = workspace.currentUi
        val refs = ui.focus.entity?.let(::setOf) ?: ui.focus.selected.toSet()
        if (
            controller.document {
                mapRemove(it, workspace.current.models.associateBy { it.uuid }, refs)
            }
        )
            workspace.clearFocus()
    }

    fun rotate(mirror: Boolean = false) {
        if (workspace.drag.transform(mirror)) return
        val ui = workspace.currentUi
        if (ui.tool is MapTool.Paste) {
            controller.ui { state ->
                val paste = state.tool as MapTool.Paste
                state.copy(
                    tool =
                        paste.copy(
                            payload =
                                transformMapClipboard(
                                    paste.payload,
                                    workspace.current.models,
                                    paste.pivot,
                                    mirror,
                                )
                        )
                )
            }
            workspace.placement.refreshPreview()
            return
        }
        if (ui.tool != MapTool.None) {
            controller.ui {
                if (mirror) it.copy(mirrored = !it.mirrored)
                else it.copy(rotation = (it.rotation + 90) % 360)
            }
            workspace.placement.refreshPreview()
            return
        }
        val doc = workspace.current.map?.document ?: return
        val models = workspace.current.models.associateBy { it.uuid }
        val ids = mapDependentTiles(doc, models, ui.focus.selected.ids(MapEntityKind.Tile))
        val rows = doc.rows("tiles").filter { it.string("id") in ids }
        if (rows != rotationRows && rows.isNotEmpty())
            pivot = mapGroupPivot(rows, emptyList(), models)
        if (
            controller.document {
                mapTransformSelection(it, models, ui.focus.selected.toSet(), mirror, pivot)
            }
        ) {
            rotationRows =
                workspace.current.map?.document?.rows("tiles")?.filter { it.string("id") in ids }
        }
    }

    fun copy() {
        val doc = workspace.current.map?.document ?: return
        val selected = workspace.currentUi.focus.selected
        if (selected.size == 1 && selected[0].kind == MapEntityKind.Decal) {
            val source = selected[0].row(doc) ?: return
            val id = UUID.randomUUID().toString()
            if (
                controller.document {
                    it.with(
                        "decals",
                        JsonArray(it.rows("decals") + source.with("id", JsonPrimitive(id))),
                    )
                }
            )
                workspace.focus(MapEntityRef(MapEntityKind.Decal, id))
            return
        }
        runCatching { mapCopy(doc, workspace.current.models, selected.toSet()) }
            .onSuccess { copy ->
                controller.ui { it.copy(clipboard = copy) }
                workspace.hint = "Скопировано"
            }
            .onFailure { controller.notice(it.message) }
    }

    fun paste() {
        val clipboard = workspace.currentUi.clipboard ?: return
        val doc = clipboard.document
        val tiles = doc.rows("tiles")
        val objects = doc.rows("objects")
        val pivot =
            if (tiles.isEmpty() && objects.isEmpty()) MapPose(0.0, 0.0)
            else mapGroupPivot(tiles, objects, workspace.current.models.associateBy { it.uuid })
        workspace.placement.tool(MapTool.Paste(clipboard, pivot))
    }

    fun area(id: String?) {
        controller.document { mapAssignArea(it, id, workspace.currentUi.focus.selected.toSet()) }
    }

    fun createArea() {
        val id = UUID.randomUUID().toString()
        if (
            controller.document { doc ->
                require(doc.rows("areas").size < 200) { "Не более 200 областей" }
                val area = buildJsonObject {
                    put("id", id)
                    put("name", "Область ${doc.rows("areas").size+1}")
                    put("color", "#8b5cf6")
                    put("hidden", false)
                    put("fog", false)
                    put("tileIds", JsonArray(emptyList()))
                    put("objectIds", JsonArray(emptyList()))
                }
                mapAssignArea(
                    doc.with("areas", JsonArray(doc.rows("areas") + area)),
                    id,
                    workspace.currentUi.focus.selected.toSet(),
                )
            }
        )
            workspace.focus(MapEntityRef(MapEntityKind.Area, id))
    }

    fun update(
        kind: MapEntityKind,
        id: String,
        key: String,
        value: JsonElement,
        group: Boolean = false,
    ) {
        if (group) controller.beginEdit()
        controller.document { doc ->
            val row = requireNotNull(MapEntityRef(kind, id).row(doc))
            when (kind) {
                MapEntityKind.Light -> mapUpdateLight(doc, id, key, value)
                MapEntityKind.Decal -> updateMapDecal(doc, id, key, value)
                else -> mapReplace(doc, kind.collection, row.with(key, value))
            }
        }
    }
}

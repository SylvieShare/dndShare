package ru.dndshare.client.ui.maps

import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*

internal class MapCameraDrag(private val workspace: MapEditorWorkspace) {
    private var ref: MapEntityRef? = null
    private var origin: MapPose? = null
    private var source: JsonObject? = null
    private var target = false

    fun start(value: MapEntityRef, aim: Boolean, point: MapPose) {
        if (!workspace.editable) return
        ref = value
        source = value.row(workspace.current.map?.document ?: return)
        origin = point
        target = aim
        workspace.focus(value)
    }

    fun move(point: MapPose, finished: Boolean) {
        val selected = ref ?: return
        val start = origin ?: return
        val row = source ?: return
        val moved = runCatching {
            translateMapCamera(row, start, point, if (target) "target" else "body")
        }
            .getOrElse {
                workspace.hint = it.message
                return
            }
        fun apply(doc: JsonObject): JsonObject {
            val current = selected.row(doc) ?: return doc
            return mapReplace(doc, "cameras", current.with("view", moved.getValue("view")))
        }
        workspace.current.map?.let { workspace.preview = apply(it.document) }
        if (finished) {
            workspace.controller.document(::apply)
            cancel()
        }
    }

    fun cancel() {
        ref = null
        origin = null
        source = null
        workspace.preview = null
        workspace.hint = null
    }
}

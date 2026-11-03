package ru.dndshare.client.ui.maps

import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*

internal class MapDragCommands(private val workspace: MapEditorWorkspace) {
    private var source: MapEntityRef? = null
    private var origin: MapPointer? = null
    private var layout: MapMoveLayout? = null
    private var originalLight: JsonObject? = null
    private var last: MapPointer? = null
    private var token = 0L
    private var pending: Pair<MapPointer, Boolean>? = null
    private var picking = false
    val active
        get() = source != null

    fun cancel() {
        token++
        source = null
        origin = null
        layout = null
        originalLight = null
        last = null
        pending = null
        workspace.preview = null
        workspace.hint = null
    }

    fun transform(mirror: Boolean): Boolean {
        val current = layout ?: return false
        layout = transformMapMove(current, workspace.current.models, mirror)
        last?.let { move(it, false) }
        return true
    }

    fun move(pointer: MapPointer, end: Boolean) {
        if (!workspace.editable) return
        val ref = source ?: pointer.hit ?: return
        val doc = workspace.current.map?.document ?: return
        if (source == null) {
            val row = ref.row(doc) ?: return
            source = ref
            origin = pointer
            if (ref.kind == MapEntityKind.Tile || ref.kind == MapEntityKind.Object) {
                layout =
                    captureMapMove(
                        doc,
                        workspace.current.models,
                        workspace.currentUi.focus.selected.toSet(),
                        ref,
                    )
                workspace.focus(MapFocus(requireNotNull(layout).selected.toList()))
            } else {
                workspace.focus(ref)
                if (ref.kind == MapEntityKind.Light && row.string("builtinKey").isNotBlank()) {
                    cancel()
                    return
                }
                originalLight = if (ref.kind == MapEntityKind.Light) row else null
            }
        }
        last = pointer
        if (ref.kind == MapEntityKind.Decal) {
            pending = pointer to end
            pickDecal()
            return
        }
        val start = origin ?: return
        fun apply(current: JsonObject): JsonObject {
            val group = layout
            if (group != null)
                return moveMapLayout(
                    current,
                    workspace.current.models,
                    group,
                    pointer.world.x - start.world.x,
                    pointer.world.y - start.world.y,
                )
            if (originalLight == null) return current
            val light = ref.row(current) ?: return current
            return mapReplace(
                current,
                "lights",
                light
                    .without("anchor")
                    .with("x", JsonPrimitive(pointer.world.x))
                    .with("y", JsonPrimitive(pointer.world.y))
                    .with("elevation", JsonPrimitive(pointer.world.elevation))
                    .with("offset", numbers(0.0, 0.0)),
            )
        }
        runCatching { apply(doc) }
            .onSuccess {
                workspace.preview = it
                workspace.previewValid = true
                if (end) {
                    workspace.controller.document(::apply)
                    cancel()
                }
            }
            .onFailure {
                workspace.previewValid = false
                workspace.hint = it.message
                if (end) cancel()
            }
    }

    private fun pickDecal() {
        if (picking) return
        val (pointer, end) = pending ?: return
        pending = null
        picking = true
        val generation = token
        val scene = workspace.scene
        if (scene == null) {
            picking = false
            cancel()
            return
        }
        scene.pickSurface(pointer.x, pointer.y) { hit ->
            picking = false
            if (generation != token) {
                pickDecal()
                return@pickSurface
            }
            val ref = source ?: return@pickSurface
            if (hit != null) {
                fun apply(doc: JsonObject): JsonObject {
                    val row = requireNotNull(ref.row(doc))
                    return mapReplace(
                        doc,
                        "decals",
                        row.with(
                                "anchor",
                                buildJsonObject {
                                    put("kind", hit.owner.kind.wire)
                                    put("id", hit.owner.id)
                                },
                            )
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
                workspace.current.map?.let { workspace.preview = apply(it.document) }
                if (end) {
                    workspace.controller.document(::apply)
                    cancel()
                }
            } else if (end) cancel()
            pickDecal()
        }
    }
}

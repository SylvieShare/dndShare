package ru.dndshare.client.ui.maps

import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import ru.dndshare.client.maps.*

/** Geometry picking starts once; subsequent pointer requests share one background calculation. */
internal class MapModelDrag(private val workspace: MapEditorWorkspace) {
    private data class Request(
        val gesture: Long,
        val serial: Long,
        val pointer: MapPointer,
        val end: Boolean,
        val layout: MapMoveLayout,
        val hit: MapEntityRef,
        val grip: MapPose,
    )

    private var source: MapEntityRef? = null
    private var layout: MapMoveLayout? = null
    private var grip: MapPose? = null
    private var latest: Pair<MapPointer, Boolean>? = null
    private var gesture = 0L
    private var serial = 0L
    private var picking = false
    private val requests = Channel<Request>(Channel.CONFLATED)
    val active
        get() = source != null

    private val worker =
        workspace.scope.launch {
            for (request in requests) resolve(request)
        }

    private suspend fun resolve(request: Request) {
        repeat(if (request.end) 3 else 1) {
            if (request.gesture != gesture || request.serial != serial) return
            val snapshot = workspace.current
            val doc = snapshot.map?.document ?: return
            val view =
                workspace.scene?.let {
                    MapPlacementView(
                        it.camera(),
                        request.pointer.x.toDouble(),
                        request.pointer.y.toDouble(),
                        it.width,
                        it.height,
                    )
                }
            val calculated =
                withContext(Dispatchers.Default) {
                    runCatching {
                        placeMapMove(
                            doc,
                            snapshot.models,
                            request.layout,
                            request.hit,
                            request.grip,
                            view,
                            request.pointer.world,
                        )
                    }
                }
            if (request.gesture != gesture || request.serial != serial) return
            // A preview must never replace a document that changed while it was calculated.
            if (
                workspace.current.map?.document != doc ||
                    workspace.current.models !== snapshot.models
            ) {
                if (!request.end) enqueue()
                return@repeat
            }
            calculated
                .onSuccess { next ->
                    workspace.preview = next
                    workspace.previewValid = true
                    workspace.hint = null
                    if (request.end) {
                        workspace.controller.document { next }
                        cancel()
                    }
                }
                .onFailure { failure ->
                    workspace.previewValid = false
                    workspace.hint = failure.message
                    if (request.end) {
                        workspace.controller.notice(failure.message)
                        cancel()
                    }
                }
            return
        }
        if (request.end && request.gesture == gesture) {
            workspace.controller.notice("Карта изменилась во время переноса. Повторите действие")
            cancel()
        }
    }

    fun move(pointer: MapPointer, end: Boolean) {
        if (!workspace.editable) return
        latest = pointer to end
        if (source == null) {
            val ref = pointer.hit ?: return
            val doc = workspace.current.map?.document ?: return
            if (ref.row(doc) == null) return
            source = ref
            picking = true
            val token = ++gesture
            val scene = workspace.scene
            if (scene == null) {
                start(pointer.world)
                return
            }
            scene.pickSurface(pointer.x, pointer.y) { hit ->
                if (token != gesture) return@pickSurface
                val point =
                    hit?.takeIf { it.owner == ref }
                        ?.world
                        ?.let { MapPose(it.x.toDouble(), it.z.toDouble(), it.y.toDouble()) }
                        ?: pointer.world
                start(point)
            }
        } else if (!picking) enqueue()
    }

    private fun start(point: MapPose) {
        val ref = source ?: return
        val doc = workspace.current.map?.document ?: return cancel()
        val captured = runCatching {
            captureMapMove(
                doc,
                workspace.current.models,
                workspace.currentUi.focus.selected.toSet(),
                ref,
            )
        }
            .getOrElse {
                workspace.controller.notice(it.message)
                cancel()
                return
            }
        grip = point
        layout = captured
        picking = false
        workspace.focus(MapFocus(captured.selected.toList()))
        enqueue()
    }

    private fun enqueue() {
        val (pointer, end) = latest ?: return
        val payload = layout ?: return
        requests.trySend(
            Request(gesture, ++serial, pointer, end, payload, source ?: return, grip ?: return)
        )
    }

    fun transform(mirror: Boolean): Boolean {
        val current = layout ?: return false
        layout = transformMapMove(current, workspace.current.models, mirror)
        enqueue()
        return true
    }

    fun cancel() {
        gesture++
        serial++
        source = null
        layout = null
        grip = null
        latest = null
        picking = false
        workspace.preview = null
        workspace.hint = null
    }

    fun close() {
        cancel()
        requests.close()
        worker.cancel()
    }
}

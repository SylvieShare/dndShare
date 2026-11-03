package ru.dndshare.client.maps.rendering

import android.os.Handler
import android.os.Looper
import com.google.android.filament.Camera
import com.google.android.filament.View
import kotlinx.coroutines.*
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.*

internal class MapScenePicker(
    private val view: View,
    private val camera: Camera,
    private val cache: MapAssetCache,
    private val scope: CoroutineScope,
    private val targets: () -> Map<Int, MapEntityRef>,
    private val entries: () -> List<MapSceneEntry>,
    private val document: () -> JsonObject?,
    private val requestFrame: () -> Unit,
    private val onError: (String?) -> Unit,
) : AutoCloseable {
    private var closed = false
    private var pendingPicks = 0
    val working
        get() = pendingPicks > 0

    private val width
        get() = view.viewport.width

    private val height
        get() = view.viewport.height

    private fun pickTarget(x: Float, y: Float, result: (MapEntityRef?) -> Unit) {
        if (closed || width == 0 || height == 0) {
            result(null)
            return
        }
        val mapping = targets()
        pendingPicks++
        view.pick(
            x.toInt().coerceIn(0, width - 1),
            (height - y.toInt() - 1).coerceIn(0, height - 1),
            Handler(requireNotNull(Looper.myLooper())),
        ) {
            pendingPicks--
            if (!closed) result(mapping[it.renderable])
        }
        requestFrame()
    }

    fun pick(x: Float, y: Float, result: (MapEntityRef?) -> Unit) {
        pickTarget(x, y) { hit ->
            Handler(Looper.getMainLooper()).post { if (!closed) result(hit) }
        }
    }

    fun hover(x: Float, y: Float, result: (MapEntityRef?) -> Unit) = pickTarget(x, y, result)

    fun pickSurface(x: Float, y: Float, result: (MapSurfaceHit?) -> Unit) {
        val snapshot = entries().associateBy { it.ref }
        val doc = document()
        val clip =
            Mat4.multiply(
                camera.getModelMatrix(null).map(Double::toFloat).toFloatArray(),
                Mat4.inverse(camera.getProjectionMatrix(null).map(Double::toFloat).toFloatArray()),
            )
        val nx = (x.toInt() + .5f) / width.coerceAtLeast(1) * 2 - 1
        val ny = 1 - (y.toInt() + .5f) / height.coerceAtLeast(1) * 2
        val origin = Mat4.point(clip, Vec3(nx, ny, -1f))
        val far = Mat4.point(clip, Vec3(nx, ny, 1f))
        pickTarget(x, y) { target ->
            val owner =
                if (target?.kind == MapEntityKind.Decal)
                    mapAnchorRef(doc?.let { target.row(it)?.get("anchor") as? JsonObject })
                else target
            val entry = snapshot[owner]
            if (entry == null) Handler(Looper.getMainLooper()).post { if (!closed) result(null) }
            else
                scope.launch {
                    try {
                        val (_, geometry) = cache.geometry(entry.model.renderUrl)
                        val hit =
                            withContext(Dispatchers.Default) {
                                val inverse = Mat4.inverse(entry.matrix)
                                val localOrigin = Mat4.point(inverse, origin)
                                mapSurfaceIntersection(
                                    geometry,
                                    localOrigin,
                                    (Mat4.point(inverse, far) - localOrigin).normalized(),
                                )
                            }
                        val found = hit?.let {
                            MapSurfaceHit(
                                requireNotNull(target),
                                entry.ref,
                                entry.model.uuid,
                                Mat4.point(entry.matrix, it.position),
                                it.position,
                                it.normal,
                            )
                        }
                        Handler(Looper.getMainLooper()).post { if (!closed) result(found) }
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (error: Exception) {
                        onError(error.message)
                        Handler(Looper.getMainLooper()).post { if (!closed) result(null) }
                    }
                }
        }
    }

    override fun close() {
        closed = true
    }
}

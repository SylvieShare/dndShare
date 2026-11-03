package ru.dndshare.client.maps.rendering

import com.google.android.filament.Box
import kotlin.math.*
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*

/**
 * An orthographic box projects exactly from its centre and three axes, without eight allocations
 * per model.
 */
internal class MapScreenProjection(camera: MapCamera, width: Int, height: Int) {
    private val origin = camera.project(MapPose(0.0, 0.0, 0.0), width, height)
    private val x = camera.project(MapPose(1.0, 0.0, 0.0), width, height)
    private val y = camera.project(MapPose(0.0, 0.0, 1.0), width, height)
    private val z = camera.project(MapPose(0.0, 1.0, 0.0), width, height)
    private val xx = (x.first - origin.first).toDouble()
    private val xy = (y.first - origin.first).toDouble()
    private val xz = (z.first - origin.first).toDouble()
    private val yx = (x.second - origin.second).toDouble()
    private val yy = (y.second - origin.second).toDouble()
    private val yz = (z.second - origin.second).toDouble()

    fun worldBox(
        x: Double,
        elevation: Double,
        y: Double,
        halfX: Double,
        halfHeight: Double,
        halfY: Double,
        width: Int,
        height: Int,
    ): Boolean {
        val sx = origin.first + xx * x + xy * elevation + xz * y
        val sy = origin.second + yx * x + yy * elevation + yz * y
        val rx = abs(xx) * halfX + abs(xy) * halfHeight + abs(xz) * halfY
        val ry = abs(yx) * halfX + abs(yy) * halfHeight + abs(yz) * halfY
        return sx + rx >= 0 && sx - rx <= width && sy + ry >= 0 && sy - ry <= height
    }

    fun intersects(
        entry: MapSceneEntry,
        bounds: Box?,
        width: Int,
        height: Int,
        margin: Double,
        shadowSlope: Double = 0.0,
    ): Boolean {
        val matrix = entry.matrix
        val center = bounds?.center
        val half = bounds?.halfExtent
        val cx = center?.get(0)?.toDouble() ?: 0.0
        val cy = center?.get(1)?.toDouble() ?: entry.model.maxHeight / 2
        val cz = center?.get(2)?.toDouble() ?: 0.0
        val hx = half?.get(0)?.toDouble() ?: entry.model.width / 2.0
        val hy = half?.get(1)?.toDouble() ?: entry.model.maxHeight.coerceAtLeast(.1) / 2
        val hz = half?.get(2)?.toDouble() ?: entry.model.height / 2.0
        val wx = matrix[0] * cx + matrix[4] * cy + matrix[8] * cz + matrix[12]
        val wy = matrix[1] * cx + matrix[5] * cy + matrix[9] * cz + matrix[13]
        val wz = matrix[2] * cx + matrix[6] * cy + matrix[10] * cz + matrix[14]
        val sx = origin.first + xx * wx + xy * wy + xz * wz
        val sy = origin.second + yx * wx + yy * wy + yz * wz
        var rx =
            abs(xx * matrix[0] + xy * matrix[1] + xz * matrix[2]) * hx +
                abs(xx * matrix[4] + xy * matrix[5] + xz * matrix[6]) * hy +
                abs(xx * matrix[8] + xy * matrix[9] + xz * matrix[10]) * hz
        var ry =
            abs(yx * matrix[0] + yy * matrix[1] + yz * matrix[2]) * hx +
                abs(yx * matrix[4] + yy * matrix[5] + yz * matrix[6]) * hy +
                abs(yx * matrix[8] + yy * matrix[9] + yz * matrix[10]) * hz
        if (shadowSlope > 0) {
            val top = max(0.0, wy + abs(matrix[1]) * hx + abs(matrix[5]) * hy + abs(matrix[9]) * hz)
            rx += (abs(xx) + abs(xz)) * top * shadowSlope + abs(xy) * top
            ry += (abs(yx) + abs(yz)) * top * shadowSlope + abs(yy) * top
        }
        return sx + rx >= -margin &&
            sx - rx <= width + margin &&
            sy + ry >= -margin &&
            sy - ry <= height + margin
    }
}

internal fun mapViewportEntries(
    context: MapContext,
    entries: List<MapSceneEntry>,
    bounds: Map<String, Box>,
    camera: MapCamera,
    width: Int,
    height: Int,
    density: Double,
    selectedLight: String? = null,
    previous: Map<MapEntityRef, MapSceneEntry> = emptyMap(),
    retained: () -> Unit = {},
): List<MapSceneEntry> {
    if (width <= 0 || height <= 0) return emptyList()
    val projection = MapScreenProjection(camera, width, height)
    val sunlight = context.document["sun"] as? JsonObject
    val lighting = context.document.flag("lightingEnabled")
    val slope =
        if (lighting && (sunlight?.flag("enabled", true) != false))
            1 /
                tan(
                    Math.toRadians(sunlight?.number("elevation", 45.0)?.coerceIn(1.0, 89.0) ?: 45.0)
                )
        else 0.0
    val shadowLights =
        if (!lighting) emptyList()
        else
            mapVisibleLights(
                    context.document.rows("lights").map { mapLightPose(it, context) },
                    camera,
                    width,
                    height,
                )
                .filter { it.source.flag("shadows") }
    return entries.filter { entry ->
        val targetVisible =
            projection.intersects(
                entry,
                bounds[entry.model.renderUrl],
                width,
                height,
                128 * density,
                slope,
            )
        val oldVisible =
            previous[entry.ref]?.let {
                projection.intersects(it, bounds[it.model.renderUrl], width, height, 128 * density)
            } == true
        if (!targetVisible && oldVisible) retained()
        targetVisible ||
            oldVisible ||
            shadowLights.any { light ->
                val radius =
                    light.source.number("radius", 6.0) +
                        hypot(entry.model.width.toDouble(), entry.model.height.toDouble()) / 2
                hypot(entry.matrix[12] - light.point.x, entry.matrix[14] - light.point.y) <= radius
            }
    }
}

/** Camera changes reconcile once per rendered frame, while snapshots can request all geometry. */
internal class MapViewportAssets {
    private var pose: MapCamera? = null
    private var size = 0 to 0
    private var stream = true
    private var dirty = true
    private var previous: List<MapSceneEntry>? = null
    private var selectedLight: String? = null
    var retainedVisual = false
        private set

    fun invalidate() {
        dirty = true
    }

    fun update(
        context: MapContext,
        entries: List<MapSceneEntry>,
        bounds: Map<String, Box>,
        camera: MapCamera,
        width: Int,
        height: Int,
        density: Double,
        streaming: Boolean,
        selectedLight: String? = null,
        previousVisual: () -> List<MapSceneEntry> = { emptyList() },
    ): List<MapSceneEntry>? {
        if (
            !dirty &&
                camera == pose &&
                size == (width to height) &&
                streaming == stream &&
                this.selectedLight == selectedLight
        )
            return null
        dirty = false
        pose = camera
        size = width to height
        stream = streaming
        this.selectedLight = selectedLight
        retainedVisual = false
        val next =
            if (streaming)
                mapViewportEntries(
                    context,
                    entries,
                    bounds,
                    camera,
                    width,
                    height,
                    density,
                    selectedLight,
                    previousVisual().associateBy { it.ref },
                    retained = { retainedVisual = true },
                )
            else entries
        if (next == previous) return null
        previous = next
        return next
    }
}

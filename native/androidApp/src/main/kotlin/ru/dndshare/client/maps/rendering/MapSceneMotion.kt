package ru.dndshare.client.maps.rendering

import kotlin.math.*
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.geometry.*

/** Visual poses never alter the canonical document or attachment coordinates. */
internal class MapSceneMotion {
    private val rotations = MapRotationMotion<MapEntityRef>()
    private var targets = emptyMap<MapEntityRef, MapSceneEntry>()
    private var anchors = emptyMap<MapEntityRef, MapEntityRef>()
    private var children = emptyMap<MapEntityRef, List<MapEntityRef>>()
    private var localPoints = emptyMap<MapEntityRef, Vec3>()
    private val matrices = mutableMapOf<MapEntityRef, FloatArray>()
    private var lastTime: Double? = null
    val changed = mutableSetOf<MapEntityRef>()
    val moving
        get() = rotations.moving

    fun sync(entries: Map<MapEntityRef, MapSceneEntry>, context: MapContext) {
        val wasMoving = moving
        targets = entries.toMap()
        anchors =
            entries.keys
                .filter { it.kind == MapEntityKind.Object }
                .mapNotNull { ref ->
                    val parent =
                        (context.objects[ref.id]?.get("placement") as? JsonObject)?.string("tileId")
                    parent
                        ?.takeIf { it.isNotBlank() }
                        ?.let { ref to MapEntityRef(MapEntityKind.Tile, it) }
                }
                .toMap()
        children = anchors.entries.groupBy({ it.value }, { it.key })
        localPoints =
            anchors
                .mapNotNull { (ref, parent) ->
                    val owner = entries[parent] ?: return@mapNotNull null
                    val child = entries[ref] ?: return@mapNotNull null
                    ref to
                        Mat4.point(
                            Mat4.inverse(owner.matrix),
                            Vec3(child.matrix[12], child.matrix[13], child.matrix[14]),
                        )
                }
                .toMap()
        rotations.retain(entries.keys)
        entries.forEach { (ref, entry) -> rotations.set(ref, decode(entry)) }
        if (!wasMoving && moving) lastTime = null
        matrices.clear()
        changed.clear()
        changed.addAll(entries.keys)
    }

    private fun decode(entry: MapSceneEntry): MapVisualPose {
        val m = entry.matrix
        val tile = entry.ref.kind == MapEntityKind.Tile
        val ox = if (tile) entry.model.placementOffset.getOrElse(0) { 0.0 } else 0.0
        val oz = if (tile) entry.model.placementOffset.getOrElse(1) { 0.0 } else 0.0
        return MapVisualPose(
            m[12] - m[0] * ox - m[8] * oz,
            m[14] - m[2] * ox - m[10] * oz,
            m[13] + (if (tile) entry.model.mountDepth else 0.0),
            -Math.toDegrees(atan2(m[8].toDouble(), m[10].toDouble())),
            mirrored = tile && m[0] * m[10] - m[2] * m[8] < 0,
            scale = if (tile) 1.0 else m[5].toDouble(),
        )
    }

    fun advance(seconds: Double, animate: Boolean): Boolean {
        val delta = lastTime?.let { max(0.0, seconds - it) * 1000 } ?: 0.0
        lastTime = seconds
        val moving = rotations.advance(delta, immediate = !animate)
        changed.clear()
        changed.addAll(rotations.changed)
        rotations.changed.forEach { changed.addAll(children[it].orEmpty()) }
        changed.forEach(matrices::remove)
        return moving
    }

    fun matrix(ref: MapEntityRef): FloatArray? {
        matrices[ref]?.let {
            return it
        }
        val entry = targets[ref] ?: return null
        val pose = rotations.pose(ref) ?: return entry.matrix
        val result =
            if (ref.kind == MapEntityKind.Tile) {
                mapTransform(
                        pose.x,
                        pose.y,
                        pose.elevation - entry.model.mountDepth,
                        pose.rotation,
                        mirrored = pose.mirrored,
                    )
                    .also { m ->
                        m[0] *= pose.mirrorScale.toFloat()
                        m[8] *= pose.mirrorScale.toFloat()
                        val ox = entry.model.placementOffset.getOrElse(0) { 0.0 }
                        val oz = entry.model.placementOffset.getOrElse(1) { 0.0 }
                        m[12] += (m[0] * ox + m[8] * oz).toFloat()
                        m[14] += (m[2] * ox + m[10] * oz).toFloat()
                    }
            } else {
                var point = Vec3(pose.x.toFloat(), pose.elevation.toFloat(), pose.y.toFloat())
                var rotation = pose.rotation
                val parent = anchors[ref]
                if (parent != null) {
                    val local = localPoints[ref]
                    val matrix = matrix(parent)
                    if (local != null && matrix != null) point = Mat4.point(matrix, local)
                    val parentPose = rotations.pose(parent)
                    if (parentPose != null && !parentPose.mirroring)
                        rotation += parentPose.rotation - decode(targets.getValue(parent)).rotation
                }
                mapTransform(
                    point.x.toDouble(),
                    point.z.toDouble(),
                    point.y.toDouble(),
                    rotation,
                    pose.scale,
                )
            }
        matrices[ref] = result
        return result
    }

    fun anchors(): MapVisualAnchors {
        val deltas =
            changed
                .mapNotNull { ref ->
                    val original = targets[ref]?.matrix ?: return@mapNotNull null
                    val visual = matrix(ref) ?: return@mapNotNull null
                    ref to Mat4.multiply(visual, Mat4.inverse(original))
                }
                .toMap()
        return MapVisualAnchors(deltas)
    }

    fun target(ref: MapEntityRef) = targets[ref]

    fun clear() {
        rotations.clear()
        targets = emptyMap()
        matrices.clear()
        anchors = emptyMap()
        children = emptyMap()
        localPoints = emptyMap()
        changed.clear()
        lastTime = null
    }
}

internal class MapVisualAnchors(val deltas: Map<MapEntityRef, FloatArray> = emptyMap()) {
    fun light(pose: MapLightPose): MapLightPose {
        val ref = mapAnchorRef(pose.source["anchor"] as? JsonObject)
        val delta = deltas[ref] ?: return pose
        val point =
            Mat4.point(
                delta,
                Vec3(pose.point.x.toFloat(), pose.worldHeight.toFloat(), pose.point.y.toFloat()),
            )
        return pose.copy(
            point = MapPose(point.x.toDouble(), point.z.toDouble(), point.y - pose.height)
        )
    }
}

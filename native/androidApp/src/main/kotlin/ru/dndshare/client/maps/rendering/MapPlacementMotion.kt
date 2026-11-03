package ru.dndshare.client.maps.rendering

import kotlin.math.*
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.maps.*

/** Ephemeral gesture state, never part of the saved document. */
data class MapPreviewSpec(
    val refs: Set<MapEntityRef> = emptySet(),
    val anchor: MapEntityRef? = null,
    val moving: Boolean = true,
)

/** Web tilePreview/objectPreview translation, lift and tile landing/cancellation. */
internal class MapPlacementMotion {
    private class Group(
        var entries: LinkedHashMap<MapEntityRef, MapSceneEntry>,
        var anchor: MapEntityRef,
        var target: MapPose,
        var position: MapPose,
        var tile: Boolean,
        var movingObject: Boolean,
        var context: MapContext,
        var dependents: Map<MapEntityRef, MapSceneEntry> = emptyMap(),
        var active: Boolean = true,
        var retiring: Boolean = false,
        var ready: Boolean = false,
        var lift: Double = 0.0,
        var opacity: Double = 1.0,
    )

    private val groups = mutableListOf<Group>()
    private var active: Group? = null
    var spec = MapPreviewSpec()
        private set

    var starting = false
        private set

    fun consumeStart(): Boolean = starting.also { starting = false }

    val changed = mutableSetOf<MapEntityRef>()
    val released = mutableSetOf<MapEntityRef>()
    val retainedRefs
        get() =
            groups.filter { it.retiring }.flatMap { it.entries.keys + it.dependents.keys }.toSet()

    /** A cancelled tile and its attached props/lights share one retiring lifetime. */
    fun context(value: MapContext): MapContext {
        val retiring = groups.filter { it.retiring }
        if (retiring.isEmpty()) return value
        var document = value.document
        for (collection in listOf("tiles", "objects", "lights")) {
            val rows = document.rows(collection).associateBy { it.string("id") }.toMutableMap()
            for (group in retiring) {
                val refs = group.entries.keys + group.dependents.keys
                for (row in group.context.document.rows(collection)) {
                    val retain =
                        when (collection) {
                            "tiles" -> MapEntityRef(MapEntityKind.Tile, row.string("id")) in refs
                            "objects" ->
                                MapEntityRef(MapEntityKind.Object, row.string("id")) in refs
                            else -> mapAnchorRef(row["anchor"] as? JsonObject) in refs
                        }
                    if (retain) rows.putIfAbsent(row.string("id"), row)
                }
            }
            document =
                document.with(
                    collection,
                    kotlinx.serialization.json.JsonArray(rows.values.toList()),
                )
        }
        return MapContext(document, value.models.values)
    }

    val moving
        get() = groups.any { it.ready && unsettled(it) }

    fun merge(
        wanted: List<MapSceneEntry>,
        context: MapContext,
        next: MapPreviewSpec,
        ready: Map<MapEntityRef, MapSceneEntry>,
    ): List<MapSceneEntry> {
        spec = next
        val byRef = wanted.associateBy { it.ref }
        val tileIds = next.refs.filter { it.kind == MapEntityKind.Tile }.map { it.id }.toSet()
        val refs =
            next.refs
                .filter { ref ->
                    ref in byRef &&
                        ref.kind in setOf(MapEntityKind.Tile, MapEntityKind.Object) &&
                        !(ref.kind == MapEntityKind.Object &&
                            (context.objects[ref.id]?.get("placement") as? JsonObject)?.string(
                                "tileId"
                            ) in tileIds)
                }
                .toSet()
        if (active?.entries?.keys != refs)
            active?.let {
                it.active = false
                active = null
            }
        if (refs.isNotEmpty()) {
            val anchor =
                next.anchor?.takeIf { it in refs }
                    ?: refs.firstOrNull { it.kind == MapEntityKind.Tile }
                    ?: refs.first()
            val entries = LinkedHashMap(refs.associateWith { byRef.getValue(it) })
            val target = anchorPoint(entries.getValue(anchor), context)
            val group =
                active
                    ?: Group(
                            entries,
                            anchor,
                            target,
                            target,
                            anchor.kind == MapEntityKind.Tile,
                            next.moving,
                            context,
                        )
                        .also {
                            groups += it
                            active = it
                        }
            group.entries = entries
            group.anchor = anchor
            group.target = target
            group.movingObject = next.moving
            group.context = context
            group.dependents =
                wanted
                    .filter { entry ->
                        entry.ref.kind == MapEntityKind.Object &&
                            (context.objects[entry.ref.id]?.get("placement") as? JsonObject)
                                ?.string("tileId") in tileIds
                    }
                    .associateBy { it.ref }
            val becameReady = !group.ready && refs.any { it in ready }
            group.ready = group.ready || becameReady
            if (becameReady) starting = true
        }
        val consumed = active?.entries?.keys.orEmpty().toMutableSet()
        for (group in groups.toList()) {
            if (group === active || group.retiring) continue
            val mapped = linkedMapOf<MapEntityRef, MapSceneEntry>()
            val moved = mutableMapOf<MapEntityRef, MapEntityRef>()
            var newAnchor: MapEntityRef? = null
            for ((old, entry) in group.entries) {
                val found =
                    byRef[old] ?: wanted.firstOrNull { it.ref !in consumed && samePose(it, entry) }
                if (found == null) break
                mapped[found.ref] = found
                if (old != found.ref) moved[old] = found.ref
                consumed += found.ref
                if (old == group.anchor) newAnchor = found.ref
            }
            if (mapped.size == group.entries.size) {
                remapped.putAll(moved)
                group.entries = mapped
                group.anchor = newAnchor ?: mapped.keys.first()
                group.target = anchorPoint(mapped.getValue(group.anchor), context)
                group.active = false
                val parents =
                    mapped.keys.filter { it.kind == MapEntityKind.Tile }.map { it.id }.toSet()
                group.dependents =
                    wanted
                        .filter {
                            it.ref.kind == MapEntityKind.Object &&
                                (context.objects[it.ref.id]?.get("placement") as? JsonObject)
                                    ?.string("tileId") in parents
                        }
                        .associateBy { it.ref }
            } else if (group.tile && group.entries.keys.any { it in ready }) {
                group.entries =
                    LinkedHashMap(
                        group.entries
                            .filterKeys { it in ready }
                            .mapValues { (ref, entry) ->
                                entry.copy(model = ready.getValue(ref).model)
                            }
                    )
                group.retiring = true
                group.active = false
                group.ready = true
                group.dependents = group.dependents.filterKeys { it in ready }
            } else groups.remove(group)
        }
        val retained =
            groups
                .filter { it.retiring }
                .flatMap { it.entries.values + it.dependents.values }
                .filter { it.ref !in byRef }
        return wanted + retained
    }

    fun ready(refs: Set<MapEntityRef>) {
        groups.forEach {
            if (!it.ready && it.entries.keys.any { ref -> ref in refs }) {
                it.ready = true
                starting = true
            }
        }
    }

    private fun anchorPoint(entry: MapSceneEntry, context: MapContext): MapPose {
        if (entry.ref.kind == MapEntityKind.Tile)
            context.tiles[entry.ref.id]?.let { row ->
                return MapPose(
                    row.number("x"),
                    row.number("y"),
                    context.placements[entry.ref.id]?.elevation ?: 0.0,
                )
            }
        return MapPose(
            entry.matrix[12].toDouble(),
            entry.matrix[14].toDouble(),
            entry.matrix[13].toDouble(),
        )
    }

    private fun samePose(a: MapSceneEntry, b: MapSceneEntry) =
        a.ref.kind == b.ref.kind &&
            a.model.uuid == b.model.uuid &&
            a.matrix.indices.all { abs(a.matrix[it] - b.matrix[it]) < .0001f }

    private fun liftTarget(group: Group) =
        if (!group.active) 0.0
        else if (group.tile) max(.22, (group.entries[group.anchor]?.model?.mountDepth ?: 0.0) + .05)
        else if (group.movingObject) .22 else 0.0

    private fun unsettled(group: Group) =
        hypot(group.position.x - group.target.x, group.position.y - group.target.y) > .001 ||
            abs(group.position.elevation - group.target.elevation) > .001 ||
            abs(group.lift - liftTarget(group)) > .001 ||
            abs(group.opacity - (if (group.retiring) 0.0 else 1.0)) > .001

    fun advance(delta: Double, animate: Boolean): Boolean {
        changed.clear()
        released.clear()
        val horizontal = if (animate) 1 - exp(-delta.coerceAtLeast(0.0) / 45) else 1.0
        for (group in groups.toList()) {
            if (!group.ready) continue
            val vertical =
                if (animate) 1 - exp(-delta.coerceAtLeast(0.0) / (if (group.tile) 80 else 45))
                else 1.0
            val lift = liftTarget(group)
            val opacity = if (group.retiring) 0.0 else 1.0
            if (unsettled(group)) changed.addAll(group.entries.keys)
            group.position =
                MapPose(
                    group.position.x + (group.target.x - group.position.x) * horizontal,
                    group.position.y + (group.target.y - group.position.y) * horizontal,
                    group.position.elevation +
                        (group.target.elevation - group.position.elevation) * horizontal,
                )
            group.lift += (lift - group.lift) * vertical
            group.opacity += (opacity - group.opacity) * vertical
            if (!unsettled(group)) {
                group.position = group.target
                group.lift = lift
                group.opacity = opacity
                if (!group.active) {
                    if (group.retiring) released.addAll(group.entries.keys + group.dependents.keys)
                    groups.remove(group)
                }
            }
        }
        return moving
    }

    fun pose(ref: MapEntityRef, target: MapVisualPose): MapVisualPose {
        val group = groups.firstOrNull { ref in it.entries } ?: return target
        if (!group.ready) return target
        return target.copy(
            x = target.x + group.position.x - group.target.x,
            y = target.y + group.position.y - group.target.y,
            elevation =
                target.elevation +
                    (if (group.tile) group.position.elevation - group.target.elevation else 0.0) +
                    group.lift,
        )
    }

    fun opacity(ref: MapEntityRef) =
        if (ref in released) 0f
        else
            groups.firstOrNull { ref in it.entries || ref in it.dependents }?.opacity?.toFloat()
                ?: 1f

    fun refs() = groups.flatMap { it.entries.keys }.toSet()

    val detailRefs
        get() = groups.flatMap { it.entries.keys + it.dependents.keys }.toSet()

    private val remapped = mutableMapOf<MapEntityRef, MapEntityRef>()

    fun consumeRemapped() = remapped.toMap().also { remapped.clear() }

    fun clear() {
        remapped.clear()
        groups.clear()
        active = null
        changed.clear()
        released.clear()
        spec = MapPreviewSpec()
    }
}

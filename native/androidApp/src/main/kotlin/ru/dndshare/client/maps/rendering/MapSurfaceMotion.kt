package ru.dndshare.client.maps.rendering

import kotlin.math.*
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*

/** Areas own visibility/fog transitions; a ready replacement owns its independent flash. */
internal class MapSurfaceMotion {
    private val hidden = MapScalarMotion<String>()
    private val fog = MapScalarMotion<String>()
    private val flashes = MapScalarMotion<MapEntityRef>()
    private var context: MapContext? = null
    private var entries = emptyMap<MapEntityRef, MapSceneEntry>()
    private val models = mutableMapOf<MapEntityRef, String>()
    private var initialized = false
    val changed = mutableSetOf<MapEntityRef>()
    val moving
        get() = hidden.moving || fog.moving || flashes.moving

    var areasChanged = false
        private set

    fun sync(context: MapContext, entries: Map<MapEntityRef, MapSceneEntry>) {
        this.context = context
        this.entries = entries.toMap()
        for ((id, area) in context.areas) {
            hidden.set(
                id,
                if (area.flag("hidden")) 0.0 else 1.0,
                initial = 1.0,
                immediate = !initialized,
                duration = 480.0,
            )
            fog.set(
                id,
                if (area.flag("fog")) 1.0 else 0.0,
                initial = 0.0,
                immediate = !initialized,
                duration = 680.0,
            )
        }
        hidden.retain(context.areas.keys)
        fog.retain(context.areas.keys)
        for ((ref, entry) in entries) if (ref.kind == MapEntityKind.Tile) {
            val previous = models.put(ref, entry.model.uuid)
            if (previous != null && previous != entry.model.uuid) {
                flashes.set(ref, 0.0, immediate = true)
                flashes.set(ref, 1.0, duration = 480.0)
            }
        }
        models.keys.retainAll(entries.keys)
        flashes.retain(entries.keys)
        initialized = true
    }

    fun advance(delta: Double, animate: Boolean): Boolean {
        hidden.advance(delta, !animate)
        fog.advance(delta, !animate)
        flashes.advance(delta, !animate)
        areasChanged = hidden.changed.isNotEmpty() || fog.changed.isNotEmpty()
        changed.clear()
        if (areasChanged) changed.addAll(entries.keys)
        changed.addAll(flashes.changed)
        return moving
    }

    private fun opacity(area: JsonObject?) =
        .12 + .88 * (area?.let { hidden.value(it.string("id")) } ?: 1.0)

    private fun mist(area: JsonObject?) = area?.let { fog.value(it.string("id"), 0.0) } ?: 0.0

    private fun flash(area: JsonObject?) = area?.let { hidden.flash(it.string("id")) } ?: 1.0

    fun style(ref: MapEntityRef): MapSurfaceStyle {
        val context = context ?: return MapSurfaceStyle()
        if (ref.kind == MapEntityKind.Tile) {
            val area = context.tileAreas[ref.id]
            return MapSurfaceStyle(
                opacity(area).toFloat(),
                max(flash(area), flashes.flash(ref)).toFloat(),
            )
        }
        val own = context.objectAreas[ref.id]
        val parent =
            context.tileAreas[
                    (context.objects[ref.id]?.get("placement") as? JsonObject)?.string("tileId")]
        return MapSurfaceStyle(
            (min(opacity(own), opacity(parent)) * (1 - max(mist(own), mist(parent)))).toFloat(),
            max(flash(own), flash(parent)).toFloat(),
        )
    }

    fun lightOpacity(row: JsonObject): Float {
        val context = context ?: return 1f
        val anchor = mapAnchorRef(row["anchor"] as? JsonObject)
        if (anchor?.kind == MapEntityKind.Object) return style(anchor).opacity
        val area =
            if (anchor?.kind == MapEntityKind.Tile) context.tileAreas[anchor.id]
            else context.areas[row.string("areaId")]
        return (opacity(area) * (1 - mist(area))).toFloat()
    }

    fun lightOpacities(): Map<String, Float> =
        if (!areasChanged) emptyMap()
        else
            context?.document?.rows("lights").orEmpty().associate {
                it.string("id") to lightOpacity(it)
            }

    fun fogMotion(): MapFogMotion {
        val areas = context?.areas.orEmpty()
        val active =
            areas
                .filter { (id, area) ->
                    (area.flag("fog") || fog.value(id, 0.0) > 0 || fog.target(id, 0.0) > 0) &&
                        (!area.flag("hidden") || hidden.value(id) > 0)
                }
                .keys
        val weights = active.associateWith { id ->
            round(fog.value(id, 0.0) * hidden.value(id) * 255) / 255
        }
        return MapFogMotion(active, weights)
    }

    fun finish() {
        advance(0.0, false)
    }

    fun clear() {
        hidden.clear()
        fog.clear()
        flashes.clear()
        context = null
        entries = emptyMap()
        models.clear()
        changed.clear()
        initialized = false
    }
}

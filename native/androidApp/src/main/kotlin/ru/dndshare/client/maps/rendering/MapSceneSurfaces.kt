package ru.dndshare.client.maps.rendering

import ru.dndshare.client.maps.*

/** Appearance grouping is independent of asset uploads and renderable ownership. */
internal class MapSceneSurfaces(
    private val poses: MapSceneMotion,
    private val apply: (MapSceneEntry, Int) -> Unit,
) {
    var surfaceGroups = emptyMap<Int, MapSurfaceStyle>()
        private set

    var surfaceIds = emptyMap<MapEntityRef, Int>()
        private set

    fun refresh(drawn: MutableMap<MapEntityRef, MapSceneEntry>, force: Boolean = false) {
        fun refreshStyles() {
            for ((ref, entry) in drawn.toMap()) {
                val style = poses.style(ref)
                drawn[ref] = entry.copy(opacity = style.opacity, brightness = style.brightness)
            }
        }
        fun distinctStyles() =
            drawn.values
                .filter { it.opacity < 1f || it.brightness > 1f }
                .map { MapSurfaceStyle(it.opacity, it.brightness) }
                .distinct()
        refreshStyles()
        var styles = distinctStyles()
        if (styles.size > 255) {
            poses.finishAppearance()
            refreshStyles()
            styles = distinctStyles()
        }
        val ids = styles.mapIndexed { index, style -> style to index + 1 }.toMap()
        surfaceGroups = ids.entries.associate { it.value to it.key }
        val next = drawn.mapValues { (_, entry) ->
            ids[MapSurfaceStyle(entry.opacity, entry.brightness)] ?: 0
        }
        if (next == surfaceIds && !force) return
        surfaceIds = next
        for ((ref, entry) in drawn) apply(entry, surfaceIds[ref] ?: 0)
    }
}

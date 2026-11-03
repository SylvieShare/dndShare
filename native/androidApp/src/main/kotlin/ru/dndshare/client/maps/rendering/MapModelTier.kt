package ru.dndshare.client.maps.rendering

enum class MapModelTier {
    Render,
    Lod,
}

/**
 * Same hysteresis as the web: switching around one threshold must not rebuild the map repeatedly.
 */
fun mapModelTier(pixels: Double, previous: MapModelTier?, forceLod: Boolean = false): MapModelTier =
    when {
        forceLod -> MapModelTier.Lod
        previous == null -> if (pixels < 72) MapModelTier.Lod else MapModelTier.Render
        previous == MapModelTier.Render -> if (pixels < 64) MapModelTier.Lod else previous
        else -> if (pixels >= 80) MapModelTier.Render else previous
    }

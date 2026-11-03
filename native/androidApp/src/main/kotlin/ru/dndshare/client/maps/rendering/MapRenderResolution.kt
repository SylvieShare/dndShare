package ru.dndshare.client.maps.rendering

import kotlin.math.*

internal data class MapRenderSize(val width: Int, val height: Int)

/** renderQuality.js: physical Android pixels enter here, logical density remains independent. */
internal fun mapRenderSize(width: Int, height: Int, density: Double): MapRenderSize {
    require(width > 0 && height > 0 && density > 0 && density.isFinite())
    val scale = minOf(1.0, 1.5 / density, sqrt(6_000_000.0 / (width.toDouble() * height)))
    return MapRenderSize(
        maxOf(1, floor(width * scale).toInt()),
        maxOf(1, floor(height * scale).toInt()),
    )
}

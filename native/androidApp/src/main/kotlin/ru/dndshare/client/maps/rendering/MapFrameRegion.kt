package ru.dndshare.client.maps.rendering

import kotlin.math.roundToInt
import ru.dndshare.client.maps.MapPose

/** Pixel crop in top-left viewport coordinates. Partial frames never replace a complete preview. */
internal data class MapFrameRegion(val left: Int, val top: Int, val width: Int, val height: Int)

internal fun mapLightFrameRegion(
    camera: MapCamera,
    point: MapPose,
    width: Int,
    height: Int,
    logicalWidth: Int,
    logicalHeight: Int,
    density: Double,
): MapFrameRegion? {
    if (width <= 0 || height <= 0 || logicalWidth <= 0 || logicalHeight <= 0) return null
    val center = camera.project(point, width, height)
    if (!center.first.isFinite() || !center.second.isFinite()) return null
    val w = (logicalWidth * density * 1.6).roundToInt().coerceAtLeast(1)
    val h = (logicalHeight * density * 1.6).roundToInt().coerceAtLeast(1)
    val left = (center.first - w / 2.0).roundToInt()
    val top = (center.second - h / 2.0).roundToInt()
    return MapFrameRegion(left, top, w, h).takeIf {
        left >= 0 && top >= 0 && left + w <= width && top + h <= height
    }
}

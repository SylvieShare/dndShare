package ru.dndshare.client.maps.rendering

import com.google.android.filament.Box
import ru.dndshare.client.maps.geometry.VolumeFogField

/** Effect animation tests the actual viewport, without the asset-prefetch/shadow halo. */
internal class MapEffectViewport(
    camera: MapCamera,
    private val width: Int,
    private val height: Int,
) {
    private val projection = MapScreenProjection(camera, width, height)

    fun model(entry: MapSceneEntry, bounds: Box) =
        width > 0 && height > 0 && projection.intersects(entry, bounds, width, height, 0.0)

    fun fire(x: Double, y: Double, elevation: Double, radius: Double, halfHeight: Double) =
        width > 0 &&
            height > 0 &&
            projection.worldBox(x, elevation, y, radius, halfHeight, radius, width, height)

    fun fog(field: VolumeFogField) =
        width > 0 &&
            height > 0 &&
            projection.worldBox(
                field.min[0] + field.size[0] / 2,
                field.min[1] + field.size[1] / 2,
                field.min[2] + field.size[2] / 2,
                field.size[0] / 2,
                field.size[1] / 2,
                field.size[2] / 2,
                width,
                height,
            )
}

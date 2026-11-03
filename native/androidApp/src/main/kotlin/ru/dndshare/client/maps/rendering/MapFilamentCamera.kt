package ru.dndshare.client.maps.rendering

import com.google.android.filament.Camera
import ru.dndshare.client.maps.*

internal fun applyMapCamera(camera: Camera, pose: MapCamera, width: Int, height: Int) {
    if (width <= 0 || height <= 0) return
    val halfWidth = pose.saved?.number("width")?.div(2) ?: width / 2.0 / pose.pixels
    val halfHeight =
        pose.saved?.let { it.number("width") / it.number("aspect", 1.0) / 2 }
            ?: height / 2.0 / pose.pixels
    camera.setProjection(
        Camera.Projection.ORTHO,
        -halfWidth,
        halfWidth,
        -halfHeight,
        halfHeight,
        .01,
        2000.0,
    )
    val eye = pose.eye
    val up = pose.up
    camera.lookAt(eye[0], eye[1], eye[2], pose.x, pose.elevation, pose.y, up[0], up[1], up[2])
}

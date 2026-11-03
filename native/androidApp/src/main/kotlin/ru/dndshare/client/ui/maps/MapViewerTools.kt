package ru.dndshare.client.ui.maps

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapViewerTools(
    scene: FilamentMapScene?,
    document: kotlinx.serialization.json.JsonObject,
    modifier: Modifier = Modifier,
) {
    val camera = scene?.cameraState?.collectAsState()?.value
    Surface(
        modifier,
        color = WebPalette.Surface.copy(alpha = .94f),
        shape = MaterialTheme.shapes.medium,
    ) {
        Row {
            MapToolButton("Приблизить", Glyph.Plus, scene != null) { scene?.zoomViewport(1.2) }
            MapToolButton("Отдалить", Glyph.Minus, scene != null) { scene?.zoomViewport(1 / 1.2) }
            MapToolButton("Вписать карту", Glyph.Target, scene != null) {
                scene?.fitViewport(document)
            }
            MapToolButton(
                if (camera?.tilt == 90.0) "Изометрический вид" else "Вид сверху",
                Glyph.Box,
                scene != null,
            ) {
                scene?.toggleTopView(document)
            }
        }
    }
}

internal fun FilamentMapScene.zoomViewport(amount: Double) =
    camera(camera().zoom(amount, width / 2.0, height / 2.0, width, height))

internal fun FilamentMapScene.fitViewport(document: kotlinx.serialization.json.JsonObject) =
    camera(camera().fit(document.number("width"), document.number("height"), width, height))

internal fun FilamentMapScene.toggleTopView(document: kotlinx.serialization.json.JsonObject) {
    val top = camera().tilt == 90.0
    camera(
        camera()
            .copy(
                tilt = if (top) 35.264389682754654 else 90.0,
                azimuth = if (top) 45.0 else 0.0,
                saved = null,
            )
            .fit(document.number("width"), document.number("height"), width, height)
    )
}

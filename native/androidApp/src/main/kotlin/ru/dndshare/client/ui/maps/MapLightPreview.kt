package ru.dndshare.client.ui.maps

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.awaitCancellation
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapLightPreview(workspace: MapEditorWorkspace, ref: MapEntityRef) {
    var image by remember(ref) { mutableStateOf<Bitmap?>(null) }
    var state by remember(ref) { mutableStateOf("waiting") }
    val scene = workspace.scene
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    // Display bitmaps are left to Android's image lifetime. Recycling a just-replaced bitmap
    // here would race Compose's RenderThread; at most one is retained by this component.
    BoxWithConstraints(
        Modifier.fillMaxSize().background(WebPalette.MapPreview).pointerInput(scene, ref) {
            detectTapGestures(
                onDoubleTap = {
                    val doc = workspace.current.map?.document ?: return@detectTapGestures
                    val row = ref.row(doc) ?: return@detectTapGestures
                    val light = mapLightPose(row, MapContext(doc, workspace.current.models))
                    scene?.camera(
                        scene
                            .camera()
                            .copy(
                                x = light.point.x,
                                y = light.point.y,
                                elevation = light.worldHeight,
                                saved = null,
                            )
                    )
                }
            )
        },
        contentAlignment = Alignment.Center,
    ) {
        val width = maxWidth.value.toInt().coerceAtLeast(1)
        val height = maxHeight.value.toInt().coerceAtLeast(1)
        LaunchedEffect(scene, ref, width, height, lifecycle) {
            if (scene == null) return@LaunchedEffect
            lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
                val observer =
                    scene.observeLight(ref.id, width, height) { frame ->
                        state = frame.state
                        frame.image?.let { image = it }
                    }
                try {
                    awaitCancellation()
                } finally {
                    observer.close()
                }
            }
        }
        val bitmap = image
        if (bitmap != null) {
            Image(
                bitmap.asImageBitmap(),
                "Кадр карты вокруг источника света",
                Modifier.fillMaxSize(),
            )
            Box(Modifier.size(6.dp).background(WebPalette.AccentSoft, CircleShape))
        } else AppGlyph(Glyph.Lightbulb, Modifier.size(48.dp))
        if (state != "live")
            Text(
                when (state) {
                    "outside" ->
                        if (bitmap == null) "Область вне кадра · двойной тап — найти"
                        else "Последний полный кадр"
                    "unavailable" -> "Не удалось обновить кадр"
                    else -> "Ожидаем кадр карты…"
                },
                Modifier.align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .background(WebPalette.Surface)
                    .padding(6.dp),
                color = WebPalette.TextMuted,
                style = ShareTypography.context,
            )
    }
}

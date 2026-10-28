package ru.dndshare.client.ui

import androidx.compose.animation.core.animate
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import coil3.ImageLoader
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import kotlin.math.min
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import ru.dndshare.client.ui.designsystem.*

/** A bounded decode and GPU-only zoom/pan; opening reuses the same account image cache. */
@Composable
internal fun RichImageViewer(url: String, label: String, images: ImageLoader?, close: () -> Unit) {
    var zoom by remember(url) { mutableFloatStateOf(1f) }
    var translation by remember(url) { mutableStateOf(Offset.Zero) }
    var viewport by remember { mutableStateOf(IntSize.Zero) }
    var imageSize by remember(url) { mutableStateOf(Size(1f, 1f)) }
    var loading by remember(url) { mutableStateOf(true) }
    var failed by remember(url) { mutableStateOf(false) }
    var retry by remember(url) { mutableIntStateOf(0) }
    var motion by remember { mutableStateOf<Job?>(null) }
    val scope = rememberCoroutineScope()
    fun bound(value: Offset, scale: Float): Offset {
        if (viewport.width == 0 || viewport.height == 0) return Offset.Zero
        val fit = min(viewport.width / imageSize.width, viewport.height / imageSize.height)
        val x = ((imageSize.width * fit * scale - viewport.width) / 2).coerceAtLeast(0f)
        val y = ((imageSize.height * fit * scale - viewport.height) / 2).coerceAtLeast(0f)
        return Offset(value.x.coerceIn(-x, x), value.y.coerceIn(-y, y))
    }
    fun transform(focus: Offset, pan: Offset, factor: Float) {
        val next = (zoom * factor).coerceIn(1f, 6f)
        val ratio = next / zoom
        val center = Offset(viewport.width / 2f, viewport.height / 2f)
        translation = bound(translation * ratio + (focus - center) * (1f - ratio) + pan, next)
        zoom = next
    }
    fun animateZoom(
        target: Float,
        point: Offset = Offset(viewport.width / 2f, viewport.height / 2f),
    ) {
        motion?.cancel()
        motion = scope.launch {
            animate(
                zoom,
                target.coerceIn(1f, 6f),
                animationSpec = tween(DesignTokens.Motion.Navigation),
            ) { value, _ ->
                transform(point, Offset.Zero, value / zoom)
            }
        }
    }
    LaunchedEffect(viewport, imageSize) { translation = bound(translation, zoom) }
    ShareFullscreenDialog(
        close,
        properties =
            DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        Box(
            Modifier.fillMaxSize()
                .background(WebPalette.Background)
                .windowInsetsPadding(WindowInsets.safeDrawing)
        ) {
            val context = LocalContext.current
            val resolution = (maxOf(viewport.width, viewport.height) * 2).coerceIn(1, 2048)
            val request =
                remember(context, url, resolution) {
                    ImageRequest.Builder(context).data(url).size(resolution).build()
                }
            val imageModifier =
                Modifier.fillMaxSize()
                    .onSizeChanged { viewport = it }
                    .pointerInput(url, viewport, imageSize) {
                        detectTransformGestures { centroid, pan, scale, _ ->
                            motion?.cancel()
                            transform(centroid, pan, scale)
                        }
                    }
                    .pointerInput(url, viewport, imageSize) {
                        detectTapGestures(
                            onDoubleTap = { point ->
                                animateZoom(if (zoom > 1f) 1f else 2.5f, point)
                            }
                        )
                    }
                    .graphicsLayer {
                        scaleX = zoom
                        scaleY = zoom
                        translationX = translation.x
                        translationY = translation.y
                    }
            val success: (coil3.compose.AsyncImagePainter.State.Success) -> Unit = {
                imageSize =
                    Size(
                        it.result.image.width.toFloat().coerceAtLeast(1f),
                        it.result.image.height.toFloat().coerceAtLeast(1f),
                    )
                loading = false
                failed = false
            }
            if (viewport.width == 0) Box(imageModifier)
            else
                key(retry) {
                    val error: (coil3.compose.AsyncImagePainter.State.Error) -> Unit = {
                        loading = false
                        failed = true
                    }
                    val pending: (coil3.compose.AsyncImagePainter.State.Loading) -> Unit = {
                        loading = true
                        failed = false
                    }
                    if (images != null)
                        AsyncImage(
                            request,
                            label,
                            imageLoader = images,
                            modifier = imageModifier,
                            contentScale = ContentScale.Fit,
                            onSuccess = success,
                            onError = error,
                            onLoading = pending,
                        )
                    else
                        AsyncImage(
                            request,
                            label,
                            modifier = imageModifier,
                            contentScale = ContentScale.Fit,
                            onSuccess = success,
                            onError = error,
                            onLoading = pending,
                        )
                }
            if (loading) CircularProgressIndicator(Modifier.align(Alignment.Center))
            if (failed)
                Column(
                    Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text("Не удалось открыть изображение", color = WebPalette.Text)
                    ShareTextButton({ retry++ }) { Text("Повторить") }
                }
            Surface(
                Modifier.align(Alignment.TopEnd).padding(8.dp),
                color = WebPalette.Surface,
                shape = MaterialTheme.shapes.small,
            ) {
                IconButton(
                    close,
                    Modifier.semantics { contentDescription = "Закрыть изображение" },
                ) {
                    AppGlyph(Glyph.Close)
                }
            }
            Surface(
                Modifier.align(Alignment.BottomCenter).padding(16.dp),
                color = WebPalette.Surface,
                shape = MaterialTheme.shapes.small,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ShareTextButton(
                        { animateZoom(zoom / 1.5f) },
                        enabled = zoom > 1f,
                        modifier =
                            Modifier.semantics { contentDescription = "Уменьшить изображение" },
                    ) {
                        Text("−")
                    }
                    ShareTextButton(
                        { animateZoom(1f) },
                        modifier =
                            Modifier.semantics {
                                contentDescription = "Сбросить масштаб изображения"
                            },
                    ) {
                        Text("${(zoom*100).toInt()}%")
                    }
                    ShareTextButton(
                        { animateZoom(zoom * 1.5f) },
                        enabled = zoom < 6f,
                        modifier =
                            Modifier.semantics { contentDescription = "Увеличить изображение" },
                    ) {
                        Text("+")
                    }
                }
            }
        }
    }
}

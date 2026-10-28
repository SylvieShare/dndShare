package ru.dndshare.client.ui.media

import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.*
import coil3.compose.AsyncImage
import kotlin.math.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun StagedImageFields(
    icon: Boolean,
    originalPath: String,
    path: String,
    enabled: Boolean,
    existingUrl: String? = null,
    images: coil3.ImageLoader? = null,
    change: (String, String) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val picker =
        rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            if (uri != null)
                scope.launch {
                    busy = true
                    error = null
                    try {
                        val file = stageImage(context, uri)
                        change("originalPath", file.path)
                        change("path", "")
                    } catch (cancelled: kotlinx.coroutines.CancellationException) {
                        throw cancelled
                    } catch (problem: Exception) {
                        error = problem.message
                    } finally {
                        busy = false
                    }
                }
        }
    TextButton(onClick = { picker.launch(arrayOf("image/*")) }, enabled = enabled && !busy) {
        Text("Выбрать изображение")
    }
    if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
    error?.let { Text(it, color = WebPalette.Danger, style = ShareTypography.context) }
    if (
        originalPath.isBlank() && path.isBlank() && !existingUrl.isNullOrBlank() && images != null
    ) {
        AsyncImage(
            existingUrl,
            "Текущее изображение",
            imageLoader = images,
            modifier = Modifier.fillMaxWidth().heightIn(max = 300.dp),
        )
        TextButton(
            onClick = {
                scope.launch {
                    busy = true
                    error = null
                    try {
                        val staged = stageExistingImage(context, images, existingUrl)
                        change("originalPath", staged.path)
                        change("path", "")
                    } catch (cancelled: kotlinx.coroutines.CancellationException) {
                        throw cancelled
                    } catch (problem: Exception) {
                        error = problem.message ?: "Не удалось загрузить изображение."
                    } finally {
                        busy = false
                    }
                }
            },
            enabled = enabled && !busy,
        ) {
            Text("Изменить обрезку")
        }
    }
    if (originalPath.isNotBlank() && path.isBlank()) {
        NativeImageCrop(originalPath, icon, enabled && !busy) { zoom, x, y, ratio ->
            scope.launch {
                busy = true
                error = null
                try {
                    val cropped = cropStagedImage(context, originalPath, ratio, zoom, x, y, icon)
                    change("path", cropped.path)
                } catch (cancelled: kotlinx.coroutines.CancellationException) {
                    throw cancelled
                } catch (problem: Exception) {
                    error = problem.message
                } finally {
                    busy = false
                }
            }
        }
    } else if (path.isNotBlank()) {
        AsyncImage(
            java.io.File(path),
            "Подготовленное изображение",
            modifier = Modifier.fillMaxWidth().heightIn(max = 300.dp),
        )
        TextButton(onClick = { change("path", "") }, enabled = enabled) { Text("Изменить обрезку") }
    }
}

@Composable
private fun NativeImageCrop(
    path: String,
    icon: Boolean,
    enabled: Boolean,
    apply: (Float, Float, Float, Float) -> Unit,
) {
    val bitmap by
        produceState<android.graphics.Bitmap?>(null, path) {
            value = withContext(Dispatchers.IO) { BitmapFactory.decodeFile(path) }
        }
    val image = bitmap ?: return
    DisposableEffect(image) { onDispose { image.recycle() } }
    var zoom by rememberSaveable(path) { mutableFloatStateOf(1f) }
    var x by rememberSaveable(path) { mutableFloatStateOf(0f) }
    var y by rememberSaveable(path) { mutableFloatStateOf(0f) }
    val ratio = if (icon) 1f else .75f
    var width by remember { mutableIntStateOf(1) }
    val baseWidth = min(image.width.toFloat(), image.height * ratio)
    fun clamp() {
        val cropWidth = baseWidth / zoom
        val cropHeight = cropWidth / ratio
        x =
            x.coerceIn(
                -(image.width - cropWidth) / 2 / image.width,
                (image.width - cropWidth) / 2 / image.width,
            )
        y =
            y.coerceIn(
                -(image.height - cropHeight) / 2 / image.height,
                (image.height - cropHeight) / 2 / image.height,
            )
    }
    Canvas(
        Modifier.fillMaxWidth()
            .aspectRatio(ratio)
            .onSizeChanged { width = it.width }
            .clipToBounds()
            .pointerInput(path, enabled) {
                if (enabled)
                    detectTransformGestures { _, pan, scale, _ ->
                        zoom = (zoom * scale).coerceIn(1f, 5f)
                        val factor = width / (baseWidth / zoom)
                        x += pan.x / factor / image.width
                        y += pan.y / factor / image.height
                        clamp()
                    }
            }
    ) {
        val factor = size.width / (baseWidth / zoom)
        val scaledWidth = image.width * factor
        val scaledHeight = image.height * factor
        drawImage(
            image.asImageBitmap(),
            dstOffset =
                IntOffset(
                    ((size.width - scaledWidth) / 2 + x * scaledWidth).roundToInt(),
                    ((size.height - scaledHeight) / 2 + y * scaledHeight).roundToInt(),
                ),
            dstSize = IntSize(scaledWidth.roundToInt(), scaledHeight.roundToInt()),
        )
    }
    Text("Переместите изображение и измените масштаб", style = ShareTypography.context)
    Slider(
        zoom,
        {
            zoom = it
            clamp()
        },
        valueRange = 1f..5f,
        enabled = enabled,
    )
    TextButton(onClick = { apply(zoom, x, y, ratio) }, enabled = enabled) {
        Text("Применить обрезку")
    }
}

package ru.dndshare.client.ui.maps

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import coil3.ImageLoader
import coil3.compose.AsyncImage
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.maps.rendering.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapFocusPreview(
    workspace: MapEditorWorkspace,
    ref: MapEntityRef,
    images: ImageLoader,
) {
    val doc = workspace.map?.document ?: return
    val row = ref.row(doc) ?: return
    if (ref.kind == MapEntityKind.Light) {
        MapLightPreview(workspace, ref)
        return
    }
    if (ref.kind == MapEntityKind.Decal) {
        AsyncImage(
            mapImageUrl(row.string("imageUrl")),
            null,
            imageLoader = images,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Fit,
        )
        return
    }
    var image by remember(ref) { mutableStateOf<Bitmap?>(null) }
    var error by remember(ref) { mutableStateOf(false) }
    var retry by remember(ref) { mutableIntStateOf(0) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(doc, workspace.models, ref, retry, lifecycle) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            delay(180)
            error = false
            try {
                val frame =
                    withContext(Dispatchers.Default) {
                        when (ref.kind) {
                            MapEntityKind.Camera -> {
                                val view = row.getValue("view").jsonObject
                                val aspect = view.number("aspect", 1.5)
                                val w = minOf(420.0, 1024 * aspect).toInt().coerceAtLeast(64)
                                workspace.snapshots.snapshot(
                                    doc,
                                    workspace.models,
                                    mapCameraView(view, w),
                                    width = w,
                                    height = (w / aspect).toInt().coerceIn(64, 1024),
                                )
                            }
                            else -> {
                                val (visible, refs) = mapPreviewSelection(doc, ref)
                                workspace.snapshots.snapshot(
                                    visible,
                                    workspace.models,
                                    focus = refs,
                                    lod = ref.kind == MapEntityKind.Area,
                                )
                            }
                        }
                    }
                image = frame
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                error = true
            }
            awaitCancellation()
        }
    }
    Box(
        Modifier.fillMaxSize().background(WebPalette.MapPreview),
        contentAlignment = Alignment.Center,
    ) {
        image?.let {
            Image(
                it.asImageBitmap(),
                "Превью ${mapEntityName(ref,doc,workspace.models)}",
                Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit,
            )
        }
        if (image == null && !error) ShareSkeletonBlock(Modifier.fillMaxSize())
        if (error)
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    "Превью недоступно",
                    style = ShareTypography.context,
                    color = WebPalette.TextMuted,
                )
                ShareTextButton({ retry++ }) { Text("Повторить") }
            }
    }
}

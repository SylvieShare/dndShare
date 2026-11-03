package ru.dndshare.client.ui.maps

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import kotlinx.coroutines.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*
import ru.dndshare.client.ui.media.stageImage

@Composable
internal fun MapDecalPalette(workspace: MapEditorWorkspace, images: ImageLoader) {
    val context = LocalContext.current.applicationContext
    val picker =
        rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
            if (uri != null) workspace.scope.launch { uploadDecal(context, workspace, uri) }
        }
    fun load() {
        workspace.scope.launch {
            try {
                workspace.decalImages = workspace.api.decals()
                workspace.decalError = null
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                workspace.decalError = error.message
            }
        }
    }
    LaunchedEffect(workspace) { if (workspace.decalImages == null) load() }
    LazyVerticalGrid(
        GridCells.Fixed(2),
        Modifier.fillMaxSize(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item(span = { GridItemSpan(2) }) {
            ShareOutlinedButton(
                {
                    picker.launch(
                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                    )
                },
                enabled = !workspace.decalUploading,
            ) {
                AppGlyph(Glyph.Upload)
                Text(if (workspace.decalUploading) "Загрузка…" else "Загрузить свою")
            }
        }
        item(span = { GridItemSpan(2) }) {
            Text(
                "Выберите декаль и нажмите на поверхность модели. Можно перетащить её из каталога.",
                style = ShareTypography.context,
                color = WebPalette.TextMuted,
            )
        }
        workspace.decalError?.let { message ->
            item(span = { GridItemSpan(2) }) {
                Column {
                    Text(message, style = ShareTypography.context, color = WebPalette.Danger)
                    ShareTextButton(::load) { Text("Повторить") }
                }
            }
        }
        for ((category, title) in
            listOf(
                "traces" to "Следы",
                "graffiti" to "Граффити",
                "posters" to "Плакаты",
                "custom" to "Свои",
            )) {
            val entries =
                if (category == "custom") workspace.decalImages.orEmpty()
                else builtinMapDecals.filter { it.category == category }
            if (entries.isNotEmpty()) {
                item(key = "heading-$category", span = { GridItemSpan(2) }) {
                    Text(title, Modifier.padding(top = 12.dp), fontSize = 14.sp)
                }
                items(entries, key = { it.id }) { image ->
                    ShareTile(
                        onClick = { workspace.placement.tool(MapTool.Decal(image)) },
                        framed = false,
                        containerColor = WebPalette.MapPreview,
                        contentPadding = PaddingValues(6.dp),
                    ) {
                        AsyncImage(
                            mapImageUrl(image.imageUrl),
                            null,
                            imageLoader = images,
                            modifier = Modifier.fillMaxWidth().height(105.dp),
                            contentScale = ContentScale.Fit,
                        )
                        Text(image.name, fontSize = 12.sp)
                    }
                }
            }
        }
        if (workspace.decalImages == null && workspace.decalError == null)
            items(2) { ShareSkeletonBlock(Modifier.fillMaxWidth(), 140.dp) }
        if (workspace.decalImages?.isEmpty() == true)
            item(span = { GridItemSpan(2) }) {
                Text(
                    "Загруженные изображения появятся в группе «Свои».",
                    style = ShareTypography.context,
                    color = WebPalette.TextMuted,
                )
            }
    }
}

private suspend fun uploadDecal(context: Context, workspace: MapEditorWorkspace, uri: Uri) {
    if (workspace.decalUploading) return
    workspace.decalUploading = true
    workspace.decalError = null
    var staged: java.io.File? = null
    try {
        staged = stageImage(context, uri, "map-decal-staging")
        val file = staged
        val payload =
            withContext(Dispatchers.IO) {
                if (file.length() > 8 * 1024 * 1024) {
                    var bitmap = requireNotNull(BitmapFactory.decodeFile(file.path))
                    try {
                        while (file.length() > 8 * 1024 * 1024) {
                            val smaller =
                                Bitmap.createScaledBitmap(
                                    bitmap,
                                    (bitmap.width * .75).toInt().coerceAtLeast(1),
                                    (bitmap.height * .75).toInt().coerceAtLeast(1),
                                    true,
                                )
                            bitmap.recycle()
                            bitmap = smaller
                            file.outputStream().use {
                                check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it))
                            }
                        }
                    } finally {
                        bitmap.recycle()
                    }
                }
                val name =
                    context.contentResolver
                        .query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
                        ?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null }
                        ?.substringBeforeLast('.')
                        ?.take(100)
                        ?.ifBlank { null } ?: "Своя декаль"
                name to file.readBytes()
            }
        val uploaded = workspace.api.uploadDecal(payload.second, payload.first, "custom")
        workspace.decalImages = listOf(uploaded) + workspace.decalImages.orEmpty()
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (error: Exception) {
        workspace.decalError = error.message ?: "Не удалось загрузить изображение"
    } finally {
        withContext(NonCancellable + Dispatchers.IO) { staged?.delete() }
        workspace.decalUploading = false
    }
}

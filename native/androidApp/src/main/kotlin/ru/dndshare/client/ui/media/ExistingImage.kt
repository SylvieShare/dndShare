package ru.dndshare.client.ui.media

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import coil3.ImageLoader
import coil3.request.ImageRequest
import coil3.request.SuccessResult
import coil3.request.allowHardware
import java.io.File
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

internal suspend fun stageExistingImage(context: Context, images: ImageLoader, url: String): File =
    withContext(Dispatchers.IO) {
        val image =
            (images.execute(
                    ImageRequest.Builder(context).data(url).size(2048).allowHardware(false).build()
                ) as? SuccessResult)
                ?.image ?: error("Не удалось загрузить изображение. Проверьте подключение.")
        val bitmap =
            Bitmap.createBitmap(
                image.width.coerceAtLeast(1),
                image.height.coerceAtLeast(1),
                Bitmap.Config.ARGB_8888,
            )
        try {
            image.draw(Canvas(bitmap))
            val directory = File(context.filesDir, "character-media").apply { mkdirs() }
            val file = File(directory, "${UUID.randomUUID()}.png")
            try {
                file.outputStream().use {
                    require(bitmap.compress(Bitmap.CompressFormat.PNG, 100, it))
                }
                file
            } catch (error: Exception) {
                file.delete()
                throw error
            }
        } finally {
            bitmap.recycle()
        }
    }

package ru.dndshare.client.ui.media

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import androidx.exifinterface.media.ExifInterface
import java.io.File
import java.util.UUID
import kotlin.math.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** App-private files survive process death; only their small paths enter form state. */
internal suspend fun stageImage(context: Context, uri: Uri): File =
    withContext(Dispatchers.IO) {
        val folder = File(context.filesDir, "character-media").apply { mkdirs() }
        val source = File(folder, "${UUID.randomUUID()}.source")
        val owned = mutableListOf<Bitmap>()
        try {
            context.contentResolver.openInputStream(uri)?.use { input ->
                source.outputStream().use { out ->
                    val buffer = ByteArray(16 * 1024)
                    var total = 0
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        total += count
                        require(total <= 30 * 1024 * 1024) { "Выберите изображение до 30 МБ." }
                        out.write(buffer, 0, count)
                    }
                }
            } ?: error("Не удалось открыть изображение.")
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(source.path, bounds)
            require(bounds.outWidth > 0 && bounds.outHeight > 0) {
                "Не удалось прочитать изображение."
            }
            var sample = 1
            while (max(bounds.outWidth, bounds.outHeight) / sample > 2048) sample *= 2
            val bitmap =
                BitmapFactory.decodeFile(
                        source.path,
                        BitmapFactory.Options().apply { inSampleSize = sample },
                    )
                    ?.also { owned.add(it) } ?: error("Не удалось прочитать изображение.")
            val orientation = runCatching {
                ExifInterface(source.path)
                    .getAttributeInt(
                        ExifInterface.TAG_ORIENTATION,
                        ExifInterface.ORIENTATION_NORMAL,
                    )
            }
                .getOrDefault(ExifInterface.ORIENTATION_NORMAL)
            val matrix =
                Matrix().apply {
                    when (orientation) {
                        ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> setScale(-1f, 1f)
                        ExifInterface.ORIENTATION_ROTATE_180 -> setRotate(180f)
                        ExifInterface.ORIENTATION_FLIP_VERTICAL -> setScale(1f, -1f)
                        ExifInterface.ORIENTATION_TRANSPOSE -> {
                            setRotate(90f)
                            postScale(-1f, 1f)
                        }
                        ExifInterface.ORIENTATION_ROTATE_90 -> setRotate(90f)
                        ExifInterface.ORIENTATION_TRANSVERSE -> {
                            setRotate(270f)
                            postScale(-1f, 1f)
                        }
                        ExifInterface.ORIENTATION_ROTATE_270 -> setRotate(270f)
                    }
                }
            val upright =
                Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true).also {
                    owned.add(it)
                }
            val result = File(folder, "${UUID.randomUUID()}.png")
            writeStagedBitmap(upright, result, Bitmap.CompressFormat.PNG, 100)
            result
        } finally {
            owned.forEach { if (!it.isRecycled) it.recycle() }
            source.delete()
        }
    }

@Suppress("DEPRECATION")
internal suspend fun cropStagedImage(
    context: Context,
    path: String,
    ratio: Float,
    zoom: Float,
    x: Float,
    y: Float,
    icon: Boolean,
): File =
    withContext(Dispatchers.IO) {
        require(
            ratio.isFinite() &&
                ratio > 0f &&
                zoom.isFinite() &&
                zoom in 1f..5f &&
                x.isFinite() &&
                y.isFinite()
        ) {
            "Проверьте область обрезки изображения."
        }
        val owned = mutableListOf<Bitmap>()
        val source =
            BitmapFactory.decodeFile(path)?.also { owned.add(it) }
                ?: error("Изображение больше не доступно. Выберите его заново.")
        try {
            val width = min(source.width.toFloat(), source.height * ratio) / zoom
            val height = width / ratio
            val left =
                ((source.width - width) / 2f - x * source.width).coerceIn(0f, source.width - width)
            val top =
                ((source.height - height) / 2f - y * source.height).coerceIn(
                    0f,
                    source.height - height,
                )
            val cropWidth = width.roundToInt().coerceIn(1, source.width)
            val cropHeight = height.roundToInt().coerceIn(1, source.height)
            val cropped =
                Bitmap.createBitmap(
                        source,
                        left.roundToInt().coerceIn(0, source.width - cropWidth),
                        top.roundToInt().coerceIn(0, source.height - cropHeight),
                        cropWidth,
                        cropHeight,
                    )
                    .also { owned.add(it) }
            val targetWidth =
                if (icon) 256
                else minOf(1536, cropped.width, (2048 * ratio).roundToInt().coerceAtLeast(1))
            val result =
                Bitmap.createScaledBitmap(
                        cropped,
                        targetWidth,
                        (targetWidth / ratio).roundToInt(),
                        true,
                    )
                    .also { owned.add(it) }
            val file =
                File(
                    File(context.filesDir, "character-media"),
                    "${UUID.randomUUID()}.${if(icon)"png" else "webp"}",
                )
            writeStagedBitmap(
                result,
                file,
                if (icon) Bitmap.CompressFormat.PNG else Bitmap.CompressFormat.WEBP,
                if (icon) 100 else 88,
            )
            require(file.length() <= 5L * 1024 * 1024) {
                file.delete()
                "Подготовленное изображение больше 5 МБ. Уменьшите область."
            }
            file
        } finally {
            owned.forEach { if (!it.isRecycled) it.recycle() }
        }
    }

internal fun writeStagedBitmap(
    bitmap: Bitmap,
    file: File,
    format: Bitmap.CompressFormat,
    quality: Int,
) {
    try {
        file.outputStream().use {
            require(bitmap.compress(format, quality, it)) { "Не удалось сохранить изображение." }
        }
        require(file.length() > 0) { "Подготовленное изображение пусто." }
    } catch (error: Exception) {
        file.delete()
        throw error
    }
}

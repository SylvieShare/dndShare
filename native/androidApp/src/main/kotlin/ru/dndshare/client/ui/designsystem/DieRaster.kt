package ru.dndshare.client.ui.designsystem

import android.graphics.*
import android.util.LruCache
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.PathParser

internal data class DieRasterKey(val shape: Int, val value: String, val color: Int, val pixels: Int)

internal data class DieRaster(val glass: ImageBitmap, val foreground: ImageBitmap, val bytes: Int)

internal object DieRasterCache {
    private val cache =
        object : LruCache<DieRasterKey, DieRaster>(8 * 1024 * 1024) {
            override fun sizeOf(key: DieRasterKey, value: DieRaster) = value.bytes
        }

    fun get(key: DieRasterKey) = cache.get(key)

    fun render(key: DieRasterKey): DieRaster {
        cache.get(key)?.let {
            return it
        }
        val shape = shareDieShapes[key.shape] ?: shareDieShapes.getValue(20)
        val path = PathParser().parsePathString(shape.path).toPath().asAndroidPath()
        val background = Bitmap.createBitmap(key.pixels, key.pixels, Bitmap.Config.ARGB_8888)
        val foreground = Bitmap.createBitmap(key.pixels, key.pixels, Bitmap.Config.ARGB_8888)
        val paint =
            Paint(Paint.ANTI_ALIAS_FLAG).apply {
                strokeJoin = Paint.Join.ROUND
                strokeCap = Paint.Cap.ROUND
            }
        fun Paint.fill(color: Int) {
            this.color = color
            style = Paint.Style.FILL
            maskFilter = null
        }
        fun Paint.outline(color: Int, width: Float) {
            this.color = color
            style = Paint.Style.STROKE
            strokeWidth = width
            maskFilter = null
        }
        val canvas = Canvas(background)
        canvas.scale(key.pixels / 56f, key.pixels / 56f)
        paint.outline(alpha(key.color, WebEffectSpec.DieHaloAlpha), WebEffectSpec.DieHaloWidth)
        canvas.drawPath(path, paint)
        paint.fill(WebEffectSpec.DieBody.toInt())
        canvas.drawPath(path, paint)
        paint.outline(WebEffectSpec.DieRim.toInt(), WebEffectSpec.DieRimWidth)
        canvas.drawPath(path, paint)
        canvas.save()
        canvas.clipPath(path)
        paint.fill(alpha(key.color, WebEffectSpec.DieLiquidAlpha))
        paint.maskFilter = BlurMaskFilter(WebEffectSpec.DieBlur, BlurMaskFilter.Blur.NORMAL)
        canvas.drawRect(0f, shape.liquidY, 56f, 56f, paint)
        paint.fill(alpha(Color.WHITE, WebEffectSpec.DieShineAlpha))
        canvas.drawRect(0f, shape.shineY, 56f, shape.shineY + 1.4f, paint)
        canvas.restore()
        val front = Canvas(foreground)
        front.scale(key.pixels / 56f, key.pixels / 56f)
        paint.outline(WebEffectSpec.DieRim.toInt(), WebEffectSpec.DieRimWidth)
        front.drawPath(path, paint)
        paint.typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        paint.textSize = shape.fontSizes[(key.value.length - 1).coerceIn(0, 3)]
        paint.textAlign = Paint.Align.CENTER
        val y = shape.textY - (paint.fontMetrics.ascent + paint.fontMetrics.descent) / 2
        paint.outline(
            0xff0a0b12.toInt(),
            when {
                key.value.length >= 4 -> 2f
                key.value.length == 3 -> 2.5f
                else -> 3f
            },
        )
        front.drawText(key.value, 28f, y, paint)
        paint.fill(Color.WHITE)
        front.drawText(key.value, 28f, y, paint)
        return DieRaster(
                background.asImageBitmap(),
                foreground.asImageBitmap(),
                background.byteCount + foreground.byteCount,
            )
            .also { cache.put(key, it) }
    }

    private fun alpha(color: Int, opacity: Float) =
        (color and 0x00ffffff) or ((Color.alpha(color) * opacity).toInt() shl 24)
}

package ru.dndshare.client.print

import android.content.Context
import android.graphics.*
import android.graphics.pdf.PdfDocument
import android.text.Html
import android.text.StaticLayout
import android.text.TextPaint
import androidx.core.content.res.ResourcesCompat
import coil3.Image
import kotlin.math.min
import ru.dndshare.client.R

internal class CharacterPdfPainter(
    context: Context,
    private val document: PdfDocument,
    private val name: String,
    private val checkCancellation: () -> Unit,
) {
    private val width = 595
    private val height = 842
    private val margin = 36f
    val available = width - margin * 2
    private val body = ResourcesCompat.getFont(context, R.font.literata) ?: Typeface.SERIF
    private val display =
        ResourcesCompat.getFont(context, R.font.cormorant_garamond) ?: Typeface.SERIF
    val textPaint =
        TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = body
            color = Color.rgb(32, 28, 40)
            textSize = 10.5f
        }
    private var page: PdfDocument.Page? = null
    private var number = 0
    private var y = margin

    private fun canvas(): Canvas {
        if (page == null) newPage()
        return requireNotNull(page).canvas
    }

    private fun newPage() {
        finish()
        number++
        page = document.startPage(PdfDocument.PageInfo.Builder(width, height, number).create())
        val canvas = requireNotNull(page).canvas
        canvas.drawColor(Color.WHITE)
        val footer =
            TextPaint(textPaint).apply {
                textSize = 8f
                color = Color.GRAY
            }
        canvas.drawText(name.take(80), margin, height - margin + 14, footer)
        canvas.drawText(number.toString(), width - margin - 14, height - margin + 14, footer)
        y = margin
    }

    private fun space(amount: Float) {
        if (page == null || y + amount > height - margin - 10) newPage()
    }

    fun layout(
        html: String,
        width: Int,
        paint: TextPaint = textPaint,
        images: Html.ImageGetter? = null,
    ): StaticLayout {
        val text = Html.fromHtml(html, Html.FROM_HTML_MODE_LEGACY, images, null).trim()
        return StaticLayout.Builder.obtain(text, 0, text.length, paint, width.coerceAtLeast(1))
            .setIncludePad(false)
            .setLineSpacing(2.5f, 1f)
            .build()
    }

    fun box(height: Float, draw: (Canvas, Float, Float) -> Unit) {
        checkCancellation()
        space(height)
        var consumed = 0f
        while (consumed < height) {
            val count = min(height - consumed, this.height - margin - 10 - y)
            if (count <= 0f) {
                newPage()
                continue
            }
            val canvas = canvas()
            canvas.save()
            canvas.clipRect(margin, y, width - margin, y + count)
            draw(canvas, margin, y - consumed)
            canvas.restore()
            y += count
            consumed += count
            if (consumed < height) newPage()
        }
    }

    fun cover(subtitle: String, image: Image?) {
        val title =
            TextPaint(textPaint).apply {
                typeface = display
                textSize = 28f
            }
        val titleWidth = (available - if (image != null) 100 else 0).toInt()
        val nameLayout =
            StaticLayout.Builder.obtain(name, 0, name.length, title, titleWidth)
                .setIncludePad(false)
                .build()
        val sub = layout(Html.escapeHtml(subtitle), titleWidth)
        val h = maxOf(88f, nameLayout.height + sub.height + 12f)
        box(h) { canvas, x, top ->
            canvas.save()
            canvas.translate(x, top)
            nameLayout.draw(canvas)
            canvas.translate(0f, nameLayout.height + 6f)
            sub.draw(canvas)
            canvas.restore()
            if (image != null && image.width > 0 && image.height > 0) {
                val scale = min(80f / image.width, 80f / image.height)
                canvas.save()
                canvas.translate(x + available - 80f, top)
                canvas.scale(scale, scale)
                image.draw(canvas)
                canvas.restore()
            }
        }
        y += 8
    }

    fun heading(text: String, large: Boolean = false) {
        val style =
            TextPaint(textPaint).apply {
                typeface = display
                textSize = if (large) 28f else 17f
            }
        val line =
            StaticLayout.Builder.obtain(text, 0, text.length, style, available.toInt())
                .setIncludePad(false)
                .build()
        space(line.height + 44f)
        y += if (large) 0 else 10
        box(line.height.toFloat()) { canvas, x, top ->
            canvas.save()
            canvas.translate(x, top)
            line.draw(canvas)
            canvas.restore()
        }
        y += 9
    }

    fun paragraph(html: String) {
        val text = layout(html, available.toInt())
        if (text.text.isEmpty()) return
        for (line in 0 until text.lineCount) {
            val top = text.getLineTop(line)
            val amount = (text.getLineBottom(line) - top).toFloat()
            box(amount) { canvas, x, y ->
                canvas.save()
                canvas.translate(x, y - top)
                text.draw(canvas)
                canvas.restore()
            }
        }
        y += 5
    }

    fun pairs(values: List<Pair<String, String>>) {
        val columns =
            if (values.size >= 4 && values.all { it.first.length <= 25 && it.second.length <= 32 })
                2
            else 1
        val cellWidth = available / columns
        val labelPaint =
            TextPaint(textPaint).apply {
                textSize = 9f
                color = Color.DKGRAY
            }
        val valuePaint =
            TextPaint(textPaint).apply { typeface = Typeface.create(body, Typeface.BOLD) }
        for ((index, row) in values.chunked(columns).withIndex()) {
            val cells = row.map { (label, value) ->
                layout(Html.escapeHtml(label), (cellWidth * .48f - 12).toInt(), labelPaint) to
                    layout(Html.escapeHtml(value), (cellWidth * .52f - 12).toInt(), valuePaint)
            }
            val rowHeight = cells.maxOf { maxOf(it.first.height, it.second.height) } + 12f
            box(rowHeight) { canvas, x, top ->
                if (index % 2 == 0)
                    canvas.drawRect(
                        x,
                        top,
                        x + available,
                        top + rowHeight,
                        Paint().apply { color = Color.rgb(246, 245, 247) },
                    )
                cells.forEachIndexed { col, (label, value) ->
                    canvas.save()
                    canvas.translate(x + cellWidth * col + 6, top + 6)
                    label.draw(canvas)
                    canvas.translate(cellWidth * .48f, 0f)
                    value.draw(canvas)
                    canvas.restore()
                }
            }
        }
        y += 6
    }

    fun portrait(image: Image) {
        if (image.width <= 0 || image.height <= 0) return
        val h = minOf(300f, available * image.height / image.width)
        val w = h * image.width / image.height
        box(h) { canvas, x, top ->
            canvas.save()
            canvas.translate(x + (available - w) / 2, top)
            canvas.scale(w / image.width, h / image.height)
            image.draw(canvas)
            canvas.restore()
        }
        y += 10
    }

    fun gap(amount: Float = 6f) {
        y += amount
    }

    fun finish() {
        page?.let(document::finishPage)
        page = null
    }
}

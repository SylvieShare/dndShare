package ru.dndshare.client.print

import android.graphics.*
import android.graphics.drawable.Drawable
import android.text.Html
import android.text.StaticLayout
import coil3.Image
import com.fleeksoft.ksoup.Ksoup
import kotlin.math.ceil
import kotlin.math.max
import ru.dndshare.client.ui.descriptionBlocks
import ru.dndshare.client.ui.designsystem.richtext.RichCell
import ru.dndshare.client.ui.designsystem.richtext.RichTableModel

/** Text, full-width media and split wide tables stay in document order. */
internal suspend fun CharacterPdfPainter.rich(html: String, image: suspend (String) -> Image?) {
    for (block in descriptionBlocks(html)) when {
        block.image != null -> {
            val loaded = image(block.image)
            if (loaded != null) portrait(loaded)
            else paragraph(Html.escapeHtml(block.alt.ifBlank { "Изображение недоступно" }))
        }
        block.table != null -> table(block.table, image)
        else -> paragraph(block.html)
    }
}

private suspend fun CharacterPdfPainter.table(html: String, image: suspend (String) -> Image?) {
    val table =
        try {
            RichTableModel(html)
        } catch (_: IllegalArgumentException) {
            Ksoup.parseBodyFragment(html).select("tr").forEach {
                paragraph(Html.escapeHtml(it.text()))
            }
            return
        }
    val bands =
        if (table.columns <= 6) listOf((0 until table.columns).toList())
        else (1 until table.columns).chunked(5).map { listOf(0) + it }
    bands.forEachIndexed { bandIndex, columns ->
        if (bands.size > 1) paragraph("Таблица · часть ${bandIndex+1}/${bands.size}")
        val colWidth = available / columns.size
        val rowHeights = FloatArray(table.rows) { 22f }
        val cache =
            object : LinkedHashMap<String, StaticLayout>(16, .75f, true) {
                override fun removeEldestEntry(
                    eldest: MutableMap.MutableEntry<String, StaticLayout>?
                ) = size > 16
            }
        fun visible(cell: RichCell) = columns.filter {
            it >= cell.column && it < cell.column + cell.columns
        }
        suspend fun text(cell: RichCell): StaticLayout {
            val count = visible(cell).size.coerceAtLeast(1)
            cache[cell.id]?.let {
                return it
            }
            val node = Ksoup.parseBodyFragment(cell.html)
            val loaded = mutableMapOf<String, Drawable>()
            for (tag in node.select("img")) {
                val url = tag.attr("src")
                val value = image(url)
                if (value == null) {
                    tag.after(tag.attr("alt").ifBlank { "Изображение недоступно" })
                    tag.remove()
                } else loaded[url] = PdfInlineImage(value, count * colWidth - 12)
            }
            return layout(
                    node.body().html(),
                    (count * colWidth - 12).toInt(),
                    android.text.TextPaint(textPaint).apply {
                        if (cell.header) typeface = Typeface.create(typeface, Typeface.BOLD)
                    },
                    Html.ImageGetter { loaded[it] },
                )
                .also { cache[cell.id] = it }
        }
        val seen = mutableSetOf<String>()
        for (row in 0 until table.rows) for (column in columns) {
            val cell = table.at(row, column) ?: continue
            if (!seen.add(cell.id)) continue
            val required = ceil((text(cell).height + 12f) / cell.rows)
            for (r in cell.row until (cell.row + cell.rows).coerceAtMost(table.rows)) rowHeights[
                r] = max(rowHeights[r], required)
        }
        val offsets = FloatArray(table.rows + 1)
        for (row in rowHeights.indices) offsets[row + 1] = offsets[row] + rowHeights[row]
        val border =
            Paint().apply {
                color = Color.rgb(210, 208, 215)
                style = Paint.Style.STROKE
                strokeWidth = .5f
            }
        val fill = Paint().apply { color = Color.rgb(241, 239, 245) }
        for (row in 0 until table.rows) {
            val cells = columns.mapNotNull { table.at(row, it) }.distinctBy { it.id }
            val layouts = cells.associate { it.id to text(it) }
            box(rowHeights[row]) { canvas, x, y ->
                cells.forEach { cell ->
                    val visible = visible(cell)
                    if (visible.isEmpty()) return@forEach
                    val left = x + columns.indexOf(visible.first()) * colWidth
                    val width = visible.size * colWidth
                    val cellHeight =
                        offsets[(cell.row + cell.rows).coerceAtMost(table.rows)] - offsets[cell.row]
                    val top = y - (offsets[row] - offsets[cell.row])
                    if (cell.header)
                        canvas.drawRect(left, top, left + width, top + cellHeight, fill)
                    canvas.drawRect(left, top, left + width, top + cellHeight, border)
                    canvas.save()
                    canvas.clipRect(left, y, left + width, y + rowHeights[row])
                    canvas.translate(left + 6, top + 6)
                    layouts.getValue(cell.id).draw(canvas)
                    canvas.restore()
                }
            }
        }
        gap()
    }
}

private class PdfInlineImage(private val image: Image, maximumWidth: Float) : Drawable() {
    init {
        val scale =
            minOf(
                maximumWidth / image.width.coerceAtLeast(1),
                180f / image.height.coerceAtLeast(1),
                1f,
            )
        setBounds(
            0,
            0,
            (image.width * scale).toInt().coerceAtLeast(1),
            (image.height * scale).toInt().coerceAtLeast(1),
        )
    }

    override fun draw(canvas: Canvas) {
        canvas.save()
        canvas.translate(bounds.left.toFloat(), bounds.top.toFloat())
        canvas.scale(
            bounds.width().toFloat() / image.width.coerceAtLeast(1),
            bounds.height().toFloat() / image.height.coerceAtLeast(1),
        )
        image.draw(canvas)
        canvas.restore()
    }

    override fun setAlpha(alpha: Int) {}

    override fun setColorFilter(colorFilter: ColorFilter?) {}

    @Deprecated("Deprecated in Java") override fun getOpacity() = PixelFormat.TRANSLUCENT
}

package ru.dndshare.client.ui.designsystem.richtext

import android.graphics.*
import android.graphics.drawable.Drawable
import android.text.*
import android.text.style.*
import com.fleeksoft.ksoup.Ksoup
import java.util.UUID

internal data class RichObject(val html: String, val label: String, val block: Boolean)

internal data class RichEditingDocument(
    val text: Spanned,
    val objects: MutableMap<String, RichObject>,
)

internal class RichHeading(val tag: String) :
    RelativeSizeSpan(
        when (tag) {
            "h1" -> 1.8f
            "h2" -> 1.5f
            else -> 1.25f
        }
    )

/**
 * Native spans for editing; embedded tables/media/reference payloads survive unrelated edits
 * intact.
 */
internal object RichHtmlCodec {
    fun decode(html: String, textColor: Int, accent: Int, textSize: Float): RichEditingDocument {
        val document = Ksoup.parseBodyFragment(html)
        val objects = linkedMapOf<String, RichObject>()
        val protected =
            document.body().select("table,img,[data-rich-node],pre,video,audio,ol").filter { node ->
                node.parents().none {
                    it.tagName() in setOf("table", "pre", "ol") || it.hasAttr("data-rich-node")
                }
            }
        for (node in protected) {
            val key = "native-rich:${UUID.randomUUID()}"
            val tag = node.tagName()
            val label =
                when (tag) {
                    "table" -> "Таблица"
                    "img" -> node.attr("alt").ifBlank { "Изображение" }
                    "ol" -> "Нумерованный список"
                    "pre" -> "Код"
                    else -> node.text().ifBlank { "Встроенный элемент" }
                }
            objects[key] =
                RichObject(
                    node.outerHtml(),
                    label,
                    tag in setOf("table", "pre", "ol", "video", "audio"),
                )
            node.before("<img src=\"$key\">")
            node.remove()
        }
        document.body().select("h1,h2,h3,h4,h5,h6").forEach { it.tagName("native-${it.tagName()}") }
        val starts = mutableMapOf<String, MutableList<Int>>()
        val handler = Html.TagHandler { opening, tag, output, _ ->
            if (tag.startsWith("native-h")) {
                if (opening) {
                    if (output.isNotEmpty() && output.last() != '\n') output.append('\n')
                    starts.getOrPut(tag) { mutableListOf() }.add(output.length)
                } else {
                    val start = starts[tag]?.removeLastOrNull() ?: output.length
                    output.setSpan(
                        RichHeading(tag.removePrefix("native-")),
                        start,
                        output.length,
                        Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                    )
                    output.setSpan(
                        StyleSpan(Typeface.BOLD),
                        start,
                        output.length,
                        Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                    )
                    output.append('\n')
                }
            }
        }
        val getter = Html.ImageGetter { key ->
            val object_ = objects[key] ?: return@ImageGetter null
            LabelDrawable(object_.label, textColor, accent, textSize).also {
                it.setBounds(0, 0, it.intrinsicWidth, it.intrinsicHeight)
            }
        }
        val parsed =
            Html.fromHtml(document.body().html(), Html.FROM_HTML_MODE_COMPACT, getter, handler)
        return RichEditingDocument(parsed, objects)
    }

    fun encode(text: Spanned, objects: Map<String, RichObject>): String {
        val document =
            Ksoup.parseBodyFragment(Html.toHtml(text, Html.TO_HTML_PARAGRAPH_LINES_INDIVIDUAL))
        val paragraphs = document.body().select("p,li")
        val lines = mutableListOf<Pair<Int, Int>>()
        var start = 0
        for (index in 0..text.length) if (index == text.length || text[index] == '\n') {
            if (index > start) lines.add(start to index)
            start = index + 1
        }
        for ((index, range) in lines.withIndex()) {
            val heading =
                text.getSpans(range.first, range.second, RichHeading::class.java).firstOrNull()
                    ?: continue
            val paragraph = paragraphs.getOrNull(index) ?: continue
            paragraph.tagName(heading.tag)
            paragraph.select("span[style*=font-size]").forEach { it.unwrap() }
        }
        document.body().select("tt").forEach { it.tagName("code") }
        for (image in document.body().select("img")) {
            val object_ = objects[image.attr("src")] ?: continue
            val parent = image.parent()
            if (object_.block && parent?.tagName() == "p" && parent.childNodes().size == 1) {
                parent.before(object_.html)
                parent.remove()
            } else {
                image.before(object_.html)
                image.remove()
            }
        }
        document.body().select("p,li").forEach {
            it.removeAttr("dir")
            it.removeAttr("style")
        }
        return document.body().html()
    }

    fun insertObject(
        editable: Editable,
        start: Int,
        end: Int,
        object_: RichObject,
        objects: MutableMap<String, RichObject>,
        textColor: Int,
        accent: Int,
        textSize: Float,
    ) {
        val key = "native-rich:${UUID.randomUUID()}"
        objects[key] = object_
        editable.replace(start, end, "\uFFFC")
        val drawable =
            LabelDrawable(object_.label, textColor, accent, textSize).also {
                it.setBounds(0, 0, it.intrinsicWidth, it.intrinsicHeight)
            }
        editable.setSpan(
            ImageSpan(drawable, key),
            start,
            start + 1,
            Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
        )
    }
}

private class LabelDrawable(
    private val label: String,
    private val color: Int,
    private val accent: Int,
    private val size: Float,
) : Drawable() {
    private val paint =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = size
            typeface = Typeface.DEFAULT
        }

    override fun getIntrinsicWidth() =
        (paint.measureText(label) + size).toInt().coerceAtMost((size * 18).toInt())

    override fun getIntrinsicHeight() = (size * 1.65f).toInt()

    override fun draw(canvas: Canvas) {
        paint.color = accent
        paint.alpha = 35
        canvas.drawRoundRect(RectF(bounds), size * .3f, size * .3f, paint)
        paint.alpha = 255
        paint.color = color
        canvas.save()
        canvas.clipRect(bounds)
        canvas.drawText(label, bounds.left + size * .35f, bounds.bottom - size * .4f, paint)
        canvas.restore()
    }

    override fun setAlpha(alpha: Int) {
        paint.alpha = alpha
    }

    override fun setColorFilter(filter: ColorFilter?) {
        paint.colorFilter = filter
    }

    @Deprecated("Deprecated in Android") override fun getOpacity() = PixelFormat.TRANSLUCENT
}

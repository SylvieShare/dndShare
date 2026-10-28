package ru.dndshare.client.ui.designsystem.richtext

import android.text.*
import android.text.style.*
import android.widget.EditText

internal fun toggleRichStyle(view: EditText, style: Int) {
    val text = view.editableText
    val start = minOf(view.selectionStart, view.selectionEnd).coerceAtLeast(0)
    val end = maxOf(view.selectionStart, view.selectionEnd).coerceAtLeast(start)
    val spans = text.getSpans(start, end, StyleSpan::class.java)
    val matching = spans.filter { it.style and style != 0 }.sortedBy { text.getSpanStart(it) }
    var covered = start
    matching.forEach {
        if (text.getSpanStart(it) <= covered) covered = maxOf(covered, text.getSpanEnd(it))
    }
    val active = if (start == end) matching.isNotEmpty() else covered >= end
    if (active)
        for (span in spans.filter { it.style and style != 0 }) {
            val from = text.getSpanStart(span)
            val to = text.getSpanEnd(span)
            text.removeSpan(span)
            if (from < start)
                text.setSpan(StyleSpan(span.style), from, start, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            if (to > end)
                text.setSpan(StyleSpan(span.style), end, to, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            val remaining = span.style and style.inv()
            if (remaining != 0)
                text.setSpan(
                    StyleSpan(remaining),
                    maxOf(start, from),
                    minOf(end, to),
                    Spanned.SPAN_EXCLUSIVE_EXCLUSIVE,
                )
        }
    else text.setSpan(StyleSpan(style), start, end, Spanned.SPAN_INCLUSIVE_INCLUSIVE)
}

internal fun richParagraphRange(view: EditText): Pair<Int, Int> {
    val text = view.text.toString()
    val start = text.lastIndexOf('\n', (view.selectionStart - 1).coerceAtLeast(-1)) + 1
    val end =
        text.indexOf('\n', view.selectionEnd.coerceAtLeast(0)).let {
            if (it < 0) text.length else it + 1
        }
    return start to end
}

internal fun toggleRichBullet(view: EditText, color: Int) {
    val (start, end) = richParagraphRange(view)
    val text = view.editableText
    val existing = text.getSpans(start, end, BulletSpan::class.java)
    var covered = start
    existing
        .sortedBy { text.getSpanStart(it) }
        .forEach {
            if (text.getSpanStart(it) <= covered) covered = maxOf(covered, text.getSpanEnd(it))
        }
    val active = if (start == end) existing.isNotEmpty() else covered >= end
    existing.forEach {
        val from = text.getSpanStart(it)
        val to = text.getSpanEnd(it)
        text.removeSpan(it)
        if (from < start) text.setSpan(BulletSpan(16, color), from, start, Spanned.SPAN_PARAGRAPH)
        if (to > end) text.setSpan(BulletSpan(16, color), end, to, Spanned.SPAN_PARAGRAPH)
    }
    if (!active) {
        if (start == end) text.setSpan(BulletSpan(16, color), start, end, Spanned.SPAN_PARAGRAPH)
        var at = start
        while (at < end) {
            val newline = text.indexOf('\n', at)
            val next = if (newline < 0 || newline >= end) end else newline + 1
            text.setSpan(BulletSpan(16, color), at, next, Spanned.SPAN_PARAGRAPH)
            at = next
        }
    }
}

internal fun setRichHeading(view: EditText, tag: String?) {
    val (start, end) = richParagraphRange(view)
    val text = view.editableText
    text.getSpans(start, end, RichHeading::class.java).forEach { text.removeSpan(it) }
    if (tag != null) text.setSpan(RichHeading(tag), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
}

internal fun setRichLink(view: EditText, url: String, label: String) {
    val text = view.editableText
    val start = minOf(view.selectionStart, view.selectionEnd).coerceAtLeast(0)
    val end = maxOf(view.selectionStart, view.selectionEnd).coerceAtLeast(start)
    val content = label.ifBlank {
        if (start == end) url else text.subSequence(start, end).toString()
    }
    clearRichLink(view)
    text.replace(start, end, content)
    text.setSpan(URLSpan(url), start, start + content.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    view.setSelection(start + content.length)
}

internal fun clearRichLink(view: EditText) {
    val text = view.editableText
    val start = minOf(view.selectionStart, view.selectionEnd).coerceAtLeast(0)
    val end = maxOf(view.selectionStart, view.selectionEnd).coerceAtLeast(start)
    for (span in text.getSpans(start, end, URLSpan::class.java)) {
        val from = text.getSpanStart(span)
        val to = text.getSpanEnd(span)
        text.removeSpan(span)
        if (start < end) {
            if (from < start)
                text.setSpan(URLSpan(span.url), from, start, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            if (to > end) text.setSpan(URLSpan(span.url), end, to, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
    }
}

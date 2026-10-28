package ru.dndshare.client.ui.designsystem.richtext

import android.text.*
import android.text.style.*
import android.widget.EditText

internal fun <T : CharacterStyle> toggleRichMark(
    view: EditText,
    type: Class<T>,
    create: () -> T,
    accept: (T) -> Boolean = { true },
) {
    val text = view.editableText
    val start = minOf(view.selectionStart, view.selectionEnd).coerceAtLeast(0)
    val end = maxOf(view.selectionStart, view.selectionEnd).coerceAtLeast(start)
    val spans = text.getSpans(start, end, type).filter(accept)
    var covered = start
    spans
        .sortedBy { text.getSpanStart(it) }
        .forEach {
            if (text.getSpanStart(it) <= covered) covered = maxOf(covered, text.getSpanEnd(it))
        }
    val active = if (start == end) spans.isNotEmpty() else covered >= end
    for (span in spans) {
        val from = text.getSpanStart(span)
        val to = text.getSpanEnd(span)
        text.removeSpan(span)
        if (from < start) text.setSpan(create(), from, start, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        if (to > end) text.setSpan(create(), end, to, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    }
    if (!active) text.setSpan(create(), start, end, Spanned.SPAN_INCLUSIVE_INCLUSIVE)
}

internal fun toggleRichUnderline(view: EditText) =
    toggleRichMark(view, UnderlineSpan::class.java, ::UnderlineSpan)

internal fun toggleRichStrike(view: EditText) =
    toggleRichMark(view, StrikethroughSpan::class.java, ::StrikethroughSpan)

internal fun toggleRichCode(view: EditText) =
    toggleRichMark(view, TypefaceSpan::class.java, { TypefaceSpan("monospace") }) {
        it.family == "monospace"
    }

internal fun toggleRichQuote(view: EditText) {
    val (start, end) = richParagraphRange(view)
    val text = view.editableText
    val spans = text.getSpans(start, end, QuoteSpan::class.java)
    if (spans.isNotEmpty()) {
        spans.forEach { span ->
            val from = text.getSpanStart(span)
            val to = text.getSpanEnd(span)
            text.removeSpan(span)
            if (from < start)
                text.setSpan(QuoteSpan(span.color), from, start, Spanned.SPAN_PARAGRAPH)
            if (to > end) text.setSpan(QuoteSpan(span.color), end, to, Spanned.SPAN_PARAGRAPH)
        }
    } else text.setSpan(QuoteSpan(), start, end, Spanned.SPAN_PARAGRAPH)
}

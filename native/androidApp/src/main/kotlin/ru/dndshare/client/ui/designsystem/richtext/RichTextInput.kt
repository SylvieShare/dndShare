package ru.dndshare.client.ui.designsystem.richtext

import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.*
import android.text.style.ImageSpan
import android.view.Gravity
import android.view.MotionEvent
import android.view.ViewConfiguration
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.res.ResourcesCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import ru.dndshare.client.R
import ru.dndshare.client.ui.designsystem.*

/**
 * Styled native editor: editing buffers stay in the view, embedded payloads are preserved as
 * objects.
 */
@Composable
internal fun RichTextInputContent(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier,
    enabled: Boolean,
    insertActions: @Composable ((String, String, Boolean) -> Unit) -> Unit,
    embeddedEditor: (@Composable (String, () -> Unit, (String?) -> Unit) -> Unit)? = null,
) {
    val buffer = remember { RichInputBuffer(value) }
    val callback by rememberUpdatedState(onValueChange)
    buffer.change = { callback(it) }
    val registry = LocalShareFormInputs.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    var link by remember { mutableStateOf(false) }
    var objectEdit by remember { mutableStateOf<Pair<ImageSpan?, RichObject>?>(null) }
    val textColor = WebPalette.Text.toArgb()
    val accent = WebPalette.AccentSoft.toArgb()
    DisposableEffect(buffer, registry, lifecycle) {
        val key = Any()
        registry?.register(key) { buffer.flush() }
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) buffer.flush()
        }
        lifecycle.addObserver(observer)
        onDispose {
            registry?.unregister(key)
            buffer.cancelPending()
            lifecycle.removeObserver(observer)
        }
    }
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, style = ShareTypography.group)
        // Reading revision also observes edits made inside the native View.
        val historyState = remember(buffer.revision) { buffer.canUndo to buffer.canRedo }
        RichToolbar(
            enabled = enabled,
            canUndo = historyState.first,
            canRedo = historyState.second,
            undo = { buffer.undo() },
            redo = { buffer.redo() },
            format = { kind ->
                buffer.edit { view ->
                    when (kind) {
                        "bold" -> toggleRichStyle(view, Typeface.BOLD)
                        "italic" -> toggleRichStyle(view, Typeface.ITALIC)
                        "underline" -> toggleRichUnderline(view)
                        "strike" -> toggleRichStrike(view)
                        "code" -> toggleRichCode(view)
                        "quote" -> toggleRichQuote(view)
                        "bullet" -> toggleRichBullet(view, textColor)
                        "normal" -> setRichHeading(view, null)
                        else -> setRichHeading(view, kind)
                    }
                }
            },
            insert = { objectEdit = null to it },
            editObject = {
                buffer.view?.let { view ->
                    val text = view.editableText
                    val cursor = view.selectionStart.coerceIn(0, text.length)
                    val span =
                        text
                            .getSpans(
                                (cursor - 1).coerceAtLeast(0),
                                (cursor + 1).coerceAtMost(text.length),
                                ImageSpan::class.java,
                            )
                            .firstOrNull()
                    span?.source?.let(buffer.objects::get)?.let { objectEdit = span to it }
                }
            },
            link = {
                buffer.view?.let { view ->
                    if (view.selectionStart == view.selectionEnd)
                        view.editableText
                            .getSpans(
                                view.selectionStart.coerceAtLeast(0),
                                view.selectionStart.coerceAtLeast(0),
                                android.text.style.URLSpan::class.java,
                            )
                            .firstOrNull()
                            ?.let { span ->
                                view.setSelection(
                                    view.editableText.getSpanStart(span),
                                    view.editableText.getSpanEnd(span),
                                )
                            }
                }
                link = true
            },
            insertActions = insertActions,
        )
        AndroidView(
            modifier = Modifier.fillMaxWidth().heightIn(min = 140.dp, max = 360.dp),
            factory = { context ->
                RichEditText(context).also { view ->
                    buffer.view = view
                    view.undo = buffer::undo
                    view.redo = buffer::redo
                    view.isSaveEnabled = false
                    view.contentDescription = label
                    view.setTextColor(textColor)
                    view.highlightColor = accent
                    view.setHintTextColor(WebPalette.TextMuted.toArgb())
                    view.hint = label
                    view.typeface = ResourcesCompat.getFont(context, R.font.literata)
                    view.textSize = 16f
                    view.minLines = 3
                    view.maxLines = 10
                    view.gravity = Gravity.TOP or Gravity.START
                    view.inputType =
                        android.text.InputType.TYPE_CLASS_TEXT or
                            android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                            android.text.InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
                    val density = context.resources.displayMetrics.density
                    view.setPadding(
                        (12 * density).toInt(),
                        (10 * density).toInt(),
                        (12 * density).toInt(),
                        (10 * density).toInt(),
                    )
                    view.background =
                        GradientDrawable().apply {
                            setColor(WebPalette.Raised.toArgb())
                            cornerRadius = 8 * density
                            setStroke(
                                density.toInt().coerceAtLeast(1),
                                WebPalette.BorderStrong.toArgb(),
                            )
                        }
                    val doc =
                        RichHtmlCodec.decode(
                            value,
                            textColor,
                            accent,
                            android.util.TypedValue.applyDimension(
                                android.util.TypedValue.COMPLEX_UNIT_SP,
                                16f,
                                context.resources.displayMetrics,
                            ),
                        )
                    buffer.objects = doc.objects
                    buffer.applying = true
                    view.setText(doc.text)
                    buffer.applying = false
                    var breakGroup = false
                    view.addTextChangedListener(
                        object : TextWatcher {
                            override fun beforeTextChanged(
                                s: CharSequence?,
                                start: Int,
                                count: Int,
                                after: Int,
                            ) {
                                if (!buffer.applying) buffer.beforeEdit()
                            }

                            override fun onTextChanged(
                                s: CharSequence?,
                                start: Int,
                                before: Int,
                                count: Int,
                            ) {
                                breakGroup =
                                    count > 0 &&
                                        s?.subSequence(start, start + count)
                                            ?.any(Char::isWhitespace) == true
                            }

                            override fun afterTextChanged(s: Editable?) {
                                if (!buffer.applying) {
                                    buffer.requestFlush(breakGroup)
                                }
                            }
                        }
                    )
                    var downX = 0f
                    var downY = 0f
                    var downAt = 0L
                    view.setOnTouchListener { _, event ->
                        if (event.action == MotionEvent.ACTION_DOWN) {
                            downX = event.x
                            downY = event.y
                            downAt = event.eventTime
                        }
                        if (
                            view.isEnabled &&
                                event.action == MotionEvent.ACTION_UP &&
                                kotlin.math.abs(event.x - downX) +
                                    kotlin.math.abs(event.y - downY) <
                                    ViewConfiguration.get(context).scaledTouchSlop &&
                                event.eventTime - downAt < ViewConfiguration.getLongPressTimeout()
                        ) {
                            val offset =
                                view
                                    .getOffsetForPosition(event.x, event.y)
                                    .coerceIn(0, view.length())
                            val span =
                                view.editableText
                                    .getSpans(
                                        offset,
                                        (offset + 1).coerceAtMost(view.length()),
                                        ImageSpan::class.java,
                                    )
                                    .firstOrNull()
                            val object_ = span?.source?.let(buffer.objects::get)
                            if (object_ != null) {
                                view.performClick()
                                objectEdit = span to object_
                                true
                            } else false
                        } else false
                    }
                    view.clearFocus()
                }
            },
            update = {
                it.isEnabled = enabled
                it.contentDescription = label
                it.hint = label
            },
        )
    }
    if (link) {
        val view = buffer.view
        val start = minOf(view?.selectionStart ?: 0, view?.selectionEnd ?: 0).coerceAtLeast(0)
        val end = maxOf(view?.selectionStart ?: 0, view?.selectionEnd ?: 0).coerceAtLeast(start)
        val existing =
            view
                ?.editableText
                ?.getSpans(start, end, android.text.style.URLSpan::class.java)
                ?.firstOrNull()
        RichLinkDialog(
            existing?.url ?: "https://",
            view?.text?.subSequence(start, end)?.toString().orEmpty(),
            { link = false },
            clear = {
                buffer.edit(::clearRichLink)
                link = false
            },
            hasLink = existing != null,
        ) { url, title ->
            buffer.edit { setRichLink(it, url, title) }
            link = false
        }
    }
    objectEdit?.let { (span, object_) ->
        val replace: (RichObject?) -> Unit = { replacement ->
            buffer.edit { view ->
                val text = view.editableText
                val start =
                    span?.let { text.getSpanStart(it) }?.takeIf { it >= 0 }
                        ?: view.selectionStart.coerceAtLeast(0)
                val end =
                    span?.let { text.getSpanEnd(it) }?.takeIf { it >= start }
                        ?: view.selectionEnd.coerceAtLeast(start)
                if (replacement == null) text.delete(start, end)
                else
                    RichHtmlCodec.insertObject(
                        text,
                        start,
                        end,
                        replacement,
                        buffer.objects,
                        textColor,
                        accent,
                        view.textSize,
                    )
                span?.source?.let { buffer.objects.remove(it) }
            }
            objectEdit = null
        }
        if (embeddedEditor != null && object_.html.contains("data-rich-node"))
            embeddedEditor(object_.html, { objectEdit = null }) { html ->
                replace(
                    html?.let {
                        object_.copy(
                            html = it,
                            label =
                                com.fleeksoft.ksoup.Ksoup.parseBodyFragment(it).text().ifBlank {
                                    object_.label
                                },
                        )
                    }
                )
            }
        else RichObjectDialog(object_, { objectEdit = null }, replace)
    }
}

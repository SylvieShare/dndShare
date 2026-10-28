package ru.dndshare.client

import android.graphics.Color
import android.text.SpannableStringBuilder
import android.text.style.StyleSpan
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.fleeksoft.ksoup.Ksoup
import kotlin.test.*
import org.junit.Test
import org.junit.runner.RunWith
import ru.dndshare.client.ui.designsystem.richtext.*

@RunWith(AndroidJUnit4::class)
class RichHtmlCodecTest {
    @Test
    fun editingProsePreservesTablesMediaAndStructuredReferences() {
        val html =
            """<p>История <strong>героя</strong>.</p><table class="lore"><tr><td colspan="2"><em>Факт</em></td></tr></table><p><img src="https://example.test/portrait.png" alt="Портрет"><span data-rich-node="item" data-rich-payload="%7B%22id%22%3A12%7D">Меч</span></p>"""
        val decoded = RichHtmlCodec.decode(html, Color.WHITE, Color.MAGENTA, 16f)
        assertEquals(3, decoded.objects.size)
        assertTrue(
            decoded.text.getSpans(0, decoded.text.length, StyleSpan::class.java).isNotEmpty()
        )
        val edited = SpannableStringBuilder(decoded.text).insert(0, "Новая ")
        val result = Ksoup.parseBodyFragment(RichHtmlCodec.encode(edited, decoded.objects))
        assertEquals("lore", result.selectFirst("table")!!.className())
        assertEquals("2", result.selectFirst("td")!!.attr("colspan"))
        assertEquals("Факт", result.selectFirst("em")!!.text())
        assertEquals("https://example.test/portrait.png", result.selectFirst("img")!!.attr("src"))
        assertEquals(
            "%7B%22id%22%3A12%7D",
            result.selectFirst("[data-rich-node]")!!.attr("data-rich-payload"),
        )
        assertTrue(result.body().text().contains("Новая История"))
    }

    @Test
    fun formattingHistoryRestoresEmbeddedPayloadsAndSelection() {
        val context =
            androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().targetContext
        androidx.test.platform.app.InstrumentationRegistry.getInstrumentation().runOnMainSync {
            val initial =
                """<p>Меч героя</p><table><tr><td>Факт</td></tr></table><p><span data-rich-node="item" data-rich-payload="%7B%22id%22%3A12%7D">Клинок</span></p>"""
            val decoded = RichHtmlCodec.decode(initial, Color.WHITE, Color.MAGENTA, 16f)
            val view = android.widget.EditText(context)
            view.setText(decoded.text)
            view.setSelection(0, 3)
            val buffer = RichInputBuffer(initial)
            buffer.view = view
            buffer.objects = decoded.objects
            var emitted = initial
            buffer.change = { emitted = it }
            buffer.edit { toggleRichUnderline(it) }
            val underline = emitted
            assertTrue(Ksoup.parseBodyFragment(underline).select("u").isNotEmpty())
            buffer.edit { toggleRichStrike(it) }
            val strike = emitted
            assertTrue(
                strike.contains("line-through") ||
                    strike.contains("<strike") ||
                    strike.contains("<del")
            )
            assertTrue(buffer.undo())
            assertEquals(underline, emitted)
            assertEquals(0, view.selectionStart)
            assertEquals(3, view.selectionEnd)
            assertTrue(buffer.redo())
            assertEquals(strike, emitted)
            val document = Ksoup.parseBodyFragment(emitted)
            assertEquals("Факт", document.selectFirst("td")!!.text())
            assertEquals(
                "%7B%22id%22%3A12%7D",
                document.selectFirst("[data-rich-node]")!!.attr("data-rich-payload"),
            )
            buffer.edit { toggleRichCode(it) }
            assertTrue(Ksoup.parseBodyFragment(emitted).select("code").isNotEmpty())
            buffer.edit { toggleRichQuote(it) }
            assertTrue(Ksoup.parseBodyFragment(emitted).select("blockquote").isNotEmpty())
        }
    }

    @Test
    fun rapidTypingDefersSerializationButSaveFlushesTheCompleteLatestText() {
        val instrumentation =
            androidx.test.platform.app.InstrumentationRegistry.getInstrumentation()
        instrumentation.runOnMainSync {
            val input = android.widget.EditText(instrumentation.targetContext)
            input.setText("Начало ")
            input.setSelection(input.length())
            val buffer = RichInputBuffer("<p>Начало </p>")
            buffer.view = input
            var changes = 0
            var latest = ""
            buffer.change = {
                changes++
                latest = it
            }
            val typed = "Персонаж".repeat(20)
            for (character in typed) {
                buffer.beforeEdit()
                input.append(character.toString())
                buffer.requestFlush()
            }
            assertEquals(0, changes)
            assertTrue(buffer.canUndo)
            buffer.flush()
            assertEquals(1, changes)
            assertEquals("Начало $typed", Ksoup.parseBodyFragment(latest).text())
            buffer.flush()
            assertEquals(1, changes)
            input.append("!")
            buffer.requestFlush()
            input.setSelection(0, 6)
            buffer.edit { toggleRichUnderline(it) }
            assertEquals(3, changes)
            assertTrue(Ksoup.parseBodyFragment(latest).text().endsWith("!"))
            assertTrue(Ksoup.parseBodyFragment(latest).select("u").isNotEmpty())
            buffer.cancelPending()
        }
    }
}

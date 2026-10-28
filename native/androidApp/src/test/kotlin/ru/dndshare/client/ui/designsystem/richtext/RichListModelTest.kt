package ru.dndshare.client.ui.designsystem.richtext

import com.fleeksoft.ksoup.Ksoup
import kotlin.test.*
import org.junit.Test

class RichListModelTest {
    @Test
    fun rowEditingReorderingAndInsertionKeepNestedNodesAndNumbering() {
        val model =
            RichListModel(
                """<ol start="5" reversed class="lore"><li value="9"><strong>Первый</strong><span data-rich-node="dice" data-rich-payload="keep">Кость</span></li><li><em>Второй</em><ol><li>Вложенный</li></ol><img src="/portrait.png"></li></ol>"""
            )
        val first = model.entries[0]
        val second = model.entries[1]
        first.html = first.html.replace("Первый", "Новый")
        model.move(second.key, -1)
        model.add().html = "<p>Третий</p>"
        val result = Ksoup.parseBodyFragment(model.html()).selectFirst("ol")!!
        assertEquals("5", result.attr("start"))
        assertTrue(result.hasAttr("reversed"))
        assertEquals("lore", result.className())
        assertEquals(3, result.children().size)
        assertEquals("Вложенный", result.child(0).selectFirst("ol li")!!.text())
        assertEquals("/portrait.png", result.child(0).selectFirst("img")!!.attr("src"))
        assertEquals("9", result.child(1).attr("value"))
        assertEquals(
            "keep",
            result.child(1).selectFirst("[data-rich-node]")!!.attr("data-rich-payload"),
        )
        model.remove(first.key)
        assertEquals(2, Ksoup.parseBodyFragment(model.html()).selectFirst("ol")!!.children().size)
    }
}

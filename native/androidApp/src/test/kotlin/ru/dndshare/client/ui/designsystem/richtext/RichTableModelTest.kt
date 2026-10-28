package ru.dndshare.client.ui.designsystem.richtext

import com.fleeksoft.ksoup.Ksoup
import kotlin.test.*
import org.junit.Test

class RichTableModelTest {
    @Test
    fun insertingAndRemovingRowsPreservesMergedContentAndAttributes() {
        val model =
            RichTableModel(
                """<table class="lore"><tbody><tr><td rowspan="2" data-key="keep"><b>Альфа</b></td><td>Бета</td></tr><tr><td>Гамма</td></tr></tbody></table>"""
            )
        val first = model.at(0, 0)!!
        assertSame(first, model.at(1, 0))
        model.addRow(0)
        assertEquals(3, first.rows)
        model.removeRow(1)
        assertEquals(2, first.rows)
        val result = Ksoup.parseBodyFragment(model.html()).selectFirst("table")!!
        assertEquals("lore", result.className())
        assertEquals("keep", result.selectFirst("td")!!.attr("data-key"))
        assertEquals("Альфа", result.selectFirst("b")!!.text())
        assertEquals(2, result.select("tr").size)
    }

    @Test
    fun mergingAndSplittingKeepsEveryCellsText() {
        val model =
            RichTableModel(
                "<table><tr><td><b>A</b></td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>"
            )
        val merged = model.merge(0 to 0, 1 to 1)
        assertEquals(2, merged.rows)
        assertEquals(2, merged.columns)
        for (text in listOf("A", "B", "C", "D")) assertTrue(merged.html.contains(text))
        model.split(merged)
        assertEquals(4, model.cells.size)
        assertTrue(model.cells.all { it.rows == 1 && it.columns == 1 })
        assertTrue(model.html().contains("<b>A</b>"))
    }

    @Test
    fun deletingASpanOriginMovesItsContentIntoTheRemainingArea() {
        val model =
            RichTableModel(
                "<table><tr><td rowspan=2 colspan=2>Сохранить</td><td>X</td></tr><tr><td>Y</td></tr></table>"
            )
        model.removeRow(0)
        model.removeColumn(0)
        assertEquals("Сохранить", Ksoup.parseBodyFragment(model.at(0, 0)!!.html).text())
        assertEquals(1, model.at(0, 0)!!.rows)
        assertEquals(1, model.at(0, 0)!!.columns)
    }
}

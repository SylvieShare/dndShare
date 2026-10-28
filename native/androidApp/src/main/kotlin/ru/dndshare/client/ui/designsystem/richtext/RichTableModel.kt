package ru.dndshare.client.ui.designsystem.richtext

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.fleeksoft.ksoup.Ksoup
import com.fleeksoft.ksoup.nodes.Element
import java.util.UUID

internal class RichCell(
    val id: String = UUID.randomUUID().toString(),
    var row: Int,
    var column: Int,
    var rows: Int = 1,
    var columns: Int = 1,
    html: String = "",
    var header: Boolean = false,
    val attributes: Map<String, String> = emptyMap(),
) {
    var html by mutableStateOf(html)
}

/** Logical cell coordinates keep merged-cell content intact during structural edits. */
internal class RichTableModel(html: String) {
    private val original = Ksoup.parseBodyFragment(html).selectFirst("table") ?: Element("table")
    val cells = mutableListOf<RichCell>()
    private val index = mutableMapOf<Pair<Int, Int>, RichCell>()
    var rows: Int = 0
        private set

    var columns: Int = 0
        private set

    init {
        val tableRows =
            original.select("tr").filter {
                it.parents().firstOrNull { parent -> parent.tagName() == "table" } === original
            }
        rows = tableRows.size.coerceAtLeast(1)
        for ((r, tr) in tableRows.withIndex()) {
            var c = 0
            for (td in tr.children().filter { it.tagName() in setOf("td", "th") }) {
                while (at(r, c) != null) c++
                val rs = td.attr("rowspan").toIntOrNull()?.coerceIn(1, 1000) ?: 1
                val cs = td.attr("colspan").toIntOrNull()?.coerceIn(1, 1000) ?: 1
                require((r + rs).toLong() * maxOf(columns, c + cs) <= 100_000) {
                    "Таблица слишком большая для редактора."
                }
                val cell =
                    RichCell(
                        row = r,
                        column = c,
                        rows = rs,
                        columns = cs,
                        html = td.html(),
                        header = td.tagName() == "th",
                        attributes =
                            td.attributes()
                                .associate { it.key to it.value }
                                .filterKeys { it !in setOf("rowspan", "colspan") },
                    )
                cells.add(cell)
                for (rr in r until r + rs) for (cc in c until c + cs) index[rr to cc] = cell
                columns = maxOf(columns, c + cs)
                rows = maxOf(rows, r + rs)
                c += cs
            }
        }
        columns = columns.coerceAtLeast(1)
        require(rows.toLong() * columns <= 100_000) { "Таблица слишком большая для редактора." }
        fillHoles()
    }

    fun at(row: Int, column: Int): RichCell? = index[row to column]

    private fun reindex() {
        index.clear()
        for (cell in cells) for (r in cell.row until cell.row + cell.rows) for (c in
            cell.column until cell.column + cell.columns) index[r to c] = cell
    }

    private fun fillHoles() {
        reindex()
        for (r in 0 until rows) for (c in 0 until columns) if (at(r, c) == null) {
            val cell = RichCell(row = r, column = c)
            cells.add(cell)
            index[r to c] = cell
        }
    }

    fun addRow(after: Int) {
        require(rows < 1000)
        for (cell in cells) if (cell.row > after) cell.row++
        else if (after in cell.row until cell.row + cell.rows - 1) cell.rows++
        rows++
        fillHoles()
    }

    fun addColumn(after: Int) {
        require(columns < 1000)
        for (cell in cells) if (cell.column > after) cell.column++
        else if (after in cell.column until cell.column + cell.columns - 1) cell.columns++
        columns++
        fillHoles()
    }

    fun removeRow(row: Int) {
        require(rows > 1) { "В таблице должна остаться хотя бы одна строка." }
        val remove = mutableListOf<RichCell>()
        for (cell in cells) when {
            cell.row == row && cell.rows == 1 -> remove.add(cell)
            row in cell.row until cell.row + cell.rows -> cell.rows--
            cell.row > row -> cell.row--
        }
        cells.removeAll(remove)
        rows--
        fillHoles()
    }

    fun removeColumn(column: Int) {
        require(columns > 1) { "В таблице должен остаться хотя бы один столбец." }
        val remove = mutableListOf<RichCell>()
        for (cell in cells) when {
            cell.column == column && cell.columns == 1 -> remove.add(cell)
            column in cell.column until cell.column + cell.columns -> cell.columns--
            cell.column > column -> cell.column--
        }
        cells.removeAll(remove)
        columns--
        fillHoles()
    }

    fun split(cell: RichCell) {
        val rs = cell.rows
        val cs = cell.columns
        cell.rows = 1
        cell.columns = 1
        for (r in cell.row until cell.row + rs) for (c in cell.column until cell.column + cs) if (
            r != cell.row || c != cell.column
        )
            cells.add(
                RichCell(row = r, column = c, header = cell.header, attributes = cell.attributes)
            )
        reindex()
    }

    fun merge(from: Pair<Int, Int>, to: Pair<Int, Int>): RichCell {
        val top = minOf(from.first, to.first)
        val bottom = maxOf(from.first, to.first)
        val left = minOf(from.second, to.second)
        val right = maxOf(from.second, to.second)
        val chosen = cells.filter {
            it.row <= bottom &&
                it.row + it.rows > top &&
                it.column <= right &&
                it.column + it.columns > left
        }
        require(chosen.size > 1) { "Выберите несколько соседних ячеек." }
        require(
            chosen.all {
                it.row >= top &&
                    it.row + it.rows - 1 <= bottom &&
                    it.column >= left &&
                    it.column + it.columns - 1 <= right
            }
        ) {
            "Выберите объединённую ячейку целиком."
        }
        val first = chosen.minWith(compareBy<RichCell> { it.row }.thenBy { it.column })
        val content =
            chosen
                .sortedWith(compareBy<RichCell> { it.row }.thenBy { it.column })
                .map { it.html }
                .filter { it.isNotBlank() }
                .joinToString("<br>")
        cells.removeAll(chosen)
        first.row = top
        first.column = left
        first.rows = bottom - top + 1
        first.columns = right - left + 1
        first.html = content
        cells.add(first)
        reindex()
        return first
    }

    fun html(): String {
        val table = original.clone()
        table
            .children()
            .filter { it.tagName() in setOf("tr", "thead", "tbody", "tfoot") }
            .forEach { it.remove() }
        val body = table.appendElement("tbody")
        val grouped = cells.groupBy { it.row }
        repeat(rows) { r ->
            val tr = body.appendElement("tr")
            grouped[r]
                .orEmpty()
                .sortedBy { it.column }
                .forEach { cell ->
                    val td = tr.appendElement(if (cell.header) "th" else "td")
                    cell.attributes.forEach { (key, value) -> td.attr(key, value) }
                    if (cell.rows > 1) td.attr("rowspan", cell.rows.toString())
                    if (cell.columns > 1) td.attr("colspan", cell.columns.toString())
                    td.html(cell.html)
                }
        }
        return table.outerHtml()
    }
}

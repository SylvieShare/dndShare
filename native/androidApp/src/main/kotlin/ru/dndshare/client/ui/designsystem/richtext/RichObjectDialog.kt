package ru.dndshare.client.ui.designsystem.richtext

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.fleeksoft.ksoup.Ksoup
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun RichObjectDialog(value: RichObject, close: () -> Unit, save: (RichObject?) -> Unit) {
    if (Ksoup.parseBodyFragment(value.html).body().children().firstOrNull()?.tagName() == "table") {
        RichTableDialog(value, close, save)
        return
    }
    if (
        Ksoup.parseBodyFragment(value.html).body().children().firstOrNull()?.tagName() in
            setOf("ol", "ul")
    ) {
        RichListDialog(value, close, save)
        return
    }
    val element =
        remember(value) { Ksoup.parseBodyFragment(value.html).body().children().firstOrNull() }
    val initialText =
        remember(value) {
            when (element?.tagName()) {
                "img" -> element.attr("alt")
                "ol" ->
                    element
                        .children()
                        .filter { it.tagName() == "li" }
                        .joinToString("\n") { it.text() }
                "pre" -> element.wholeText()
                else -> element?.text().orEmpty()
            }
        }
    var text by remember(value) { mutableStateOf(initialText) }
    var url by remember(value) { mutableStateOf(element?.attr("src").orEmpty()) }
    var error by remember { mutableStateOf<String?>(null) }
    val inputs = remember { ShareFormInputs() }
    CompositionLocalProvider(LocalShareFormInputs provides inputs) {
        ShareFormDialog(
            value.label,
            close,
            actions = {
                TextButton(onClick = { save(null) }) { Text("Удалить", color = WebPalette.Danger) }
                TextButton(close) { Text("Отмена") }
                Button(
                    onClick = {
                        inputs.flush()
                        if (element == null) {
                            error = "Не удалось прочитать элемент."
                            return@Button
                        }
                        if (text == initialText && url == element.attr("src")) {
                            save(value)
                            return@Button
                        }
                        when (element.tagName()) {
                            "img" -> {
                                if (
                                    !(url.startsWith("https://") ||
                                        url.startsWith("http://") ||
                                        url.startsWith("data:image/") ||
                                        url.startsWith('/'))
                                ) {
                                    error = "Укажите адрес изображения."
                                    return@Button
                                }
                                element.attr("src", url)
                                element.attr("alt", text)
                            }
                            "pre" -> {
                                element.empty()
                                element.appendElement("code").text(text)
                            }
                            "ol" -> {
                                element.empty()
                                text.split('\n').forEach { element.appendElement("li").text(it) }
                            }
                            else -> element.text(text)
                        }
                        save(
                            value.copy(
                                html = element.outerHtml(),
                                label =
                                    if (element.tagName() == "img") text.ifBlank { "Изображение" }
                                    else value.label,
                            )
                        )
                    }
                ) {
                    Text("Сохранить")
                }
            },
        ) {
            when (element?.tagName()) {
                "img" -> {
                    if (!url.startsWith("data:"))
                        ShareTextInput(url, { url = it }, "Адрес изображения")
                    ShareTextInput(text, { text = it }, "Описание изображения")
                }
                "ol" -> {
                    ShareTextInput(
                        initialText,
                        { text = it },
                        "Пункты — каждый с новой строки",
                        multiline = true,
                    )
                }
                else -> ShareTextInput(text, { text = it }, "Текст", multiline = true)
            }
            error?.let { Text(it, color = WebPalette.Danger) }
        }
    }
}

@Composable
private fun RichTableDialog(value: RichObject, close: () -> Unit, save: (RichObject?) -> Unit) {
    val parsed = remember(value) { runCatching { RichTableModel(value.html) } }
    val table = parsed.getOrNull()
    if (table == null) {
        ShareFormDialog("Таблица", close) {
            Text(parsed.exceptionOrNull()?.message ?: "Не удалось открыть таблицу.")
        }
        return
    }
    var rowStart by remember { mutableIntStateOf(0) }
    var columnStart by remember { mutableIntStateOf(0) }
    var revision by remember { mutableIntStateOf(0) }
    var selected by remember { mutableStateOf(table.cells.first().id) }
    var anchor by remember { mutableStateOf<Pair<Int, Int>?>(null) }
    var extent by remember { mutableStateOf<Pair<Int, Int>?>(null) }
    var range by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val inputs = remember { ShareFormInputs() }
    fun action(block: () -> Unit) {
        inputs.flush()
        try {
            block()
            revision++
            error = null
        } catch (e: Exception) {
            error = e.message
        }
    }
    CompositionLocalProvider(LocalShareFormInputs provides inputs) {
        ShareFormDialog(
            "Таблица",
            close,
            actions = {
                TextButton(onClick = { save(null) }) {
                    Text("Удалить таблицу", color = WebPalette.Danger)
                }
                TextButton(close) { Text("Отмена") }
                Button(
                    onClick = {
                        inputs.flush()
                        save(value.copy(html = table.html()))
                    }
                ) {
                    Text("Сохранить")
                }
            },
        ) {
            Text("${table.rows} × ${table.columns}", style = ShareTypography.group)
            Row {
                TextButton(
                    onClick = { rowStart = (rowStart - 10).coerceAtLeast(0) },
                    enabled = rowStart > 0,
                ) {
                    Text("↑ 10 строк")
                }
                TextButton(onClick = { rowStart += 10 }, enabled = rowStart + 10 < table.rows) {
                    Text("↓ 10 строк")
                }
                TextButton(
                    onClick = { columnStart = (columnStart - 8).coerceAtLeast(0) },
                    enabled = columnStart > 0,
                ) {
                    Text("← 8")
                }
                TextButton(
                    onClick = { columnStart += 8 },
                    enabled = columnStart + 8 < table.columns,
                ) {
                    Text("8 →")
                }
            }
            val firstRow = rowStart.coerceAtMost((table.rows - 1).coerceAtLeast(0))
            val firstColumn = columnStart.coerceAtMost((table.columns - 1).coerceAtLeast(0))
            Text(
                "Строки ${firstRow+1}–${minOf(firstRow+10,table.rows)}, столбцы ${firstColumn+1}–${minOf(firstColumn+8,table.columns)}",
                style = ShareTypography.context,
            )
            val scroll = rememberScrollState()
            key(revision) {
                Column(
                    Modifier.fillMaxWidth().horizontalScroll(scroll),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    for (row in firstRow until minOf(firstRow + 10, table.rows)) Row(
                        horizontalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        var column = firstColumn
                        while (column < minOf(firstColumn + 8, table.columns)) {
                            val cell = table.at(row, column)!!
                            val currentColumn = column
                            val width =
                                (minOf(cell.column + cell.columns, firstColumn + 8, table.columns) -
                                    column) * 120
                            Surface(
                                onClick = {
                                    inputs.flush()
                                    selected = cell.id
                                    if (range) {
                                        if (anchor == null) {
                                            anchor = row to currentColumn
                                            extent = null
                                        } else extent = row to currentColumn
                                    }
                                },
                                color =
                                    if (selected == cell.id) WebPalette.Active
                                    else WebPalette.Raised,
                                modifier = Modifier.width(width.dp).height(58.dp),
                            ) {
                                Text(
                                    Ksoup.parseBodyFragment(cell.html).text().ifBlank { "…" },
                                    Modifier.padding(8.dp),
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                            column = cell.column + cell.columns
                        }
                    }
                }
            }
            val cell = table.cells.firstOrNull { it.id == selected } ?: table.cells.first()
            key(cell.id, revision) {
                ShareRichTextInput(cell.html, { cell.html = it }, "Содержимое ячейки")
            }
            Row {
                Checkbox(cell.header, { action { cell.header = it } })
                Text("Ячейка заголовка")
                Checkbox(
                    range,
                    {
                        range = it
                        anchor = null
                        extent = null
                    },
                )
                Text("Диапазон")
            }
            FlowRow {
                TextButton(onClick = { action { table.addRow(cell.row) } }) { Text("+ Строка") }
                TextButton(onClick = { action { table.addColumn(cell.column) } }) {
                    Text("+ Столбец")
                }
                TextButton(onClick = { action { table.removeRow(cell.row) } }) { Text("− Строка") }
                TextButton(onClick = { action { table.removeColumn(cell.column) } }) {
                    Text("− Столбец")
                }
                TextButton(onClick = { action { table.split(cell) } }) { Text("Разделить") }
                if (anchor != null && extent != null)
                    TextButton(
                        onClick = {
                            action {
                                selected = table.merge(anchor!!, extent!!).id
                                anchor = null
                                extent = null
                            }
                        }
                    ) {
                        Text("Объединить")
                    }
            }
            error?.let { Text(it, color = WebPalette.Danger) }
        }
    }
}

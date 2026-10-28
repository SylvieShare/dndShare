package ru.dndshare.client.ui.designsystem.richtext

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun RichToolbar(
    enabled: Boolean,
    canUndo: Boolean,
    canRedo: Boolean,
    undo: () -> Unit,
    redo: () -> Unit,
    format: (String) -> Unit,
    insert: (RichObject) -> Unit,
    editObject: () -> Unit,
    link: () -> Unit,
    insertActions: @Composable ((String, String, Boolean) -> Unit) -> Unit,
) {
    var more by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth()) {
        Row(Modifier.weight(1f).horizontalScroll(rememberScrollState())) {
            for ((key, label, glyph) in
                listOf(
                    Triple("bold", "Полужирный", Glyph.Bold),
                    Triple("italic", "Курсив", Glyph.Italic),
                    Triple("underline", "Подчёркнутый", Glyph.Underline),
                )) IconButton(
                { format(key) },
                enabled = enabled,
                modifier = Modifier.semantics { contentDescription = label },
            ) {
                AppGlyph(glyph)
            }
            IconButton(
                undo,
                enabled = enabled && canUndo,
                modifier = Modifier.semantics { contentDescription = "Отменить изменение" },
            ) {
                AppGlyph(Glyph.Undo)
            }
            IconButton(
                redo,
                enabled = enabled && canRedo,
                modifier = Modifier.semantics { contentDescription = "Повторить изменение" },
            ) {
                AppGlyph(Glyph.Redo)
            }
        }
        Box {
            IconButton(
                { more = true },
                enabled = enabled,
                modifier = Modifier.semantics { contentDescription = "Форматирование и вставка" },
            ) {
                AppGlyph(Glyph.More)
            }
            DropdownMenu(more, { more = false }) {
                for ((key, title) in
                    listOf(
                        "strike" to "Зачёркнутый",
                        "code" to "Код в строке",
                        "quote" to "Цитата",
                        "bullet" to "Маркированный список",
                        "normal" to "Обычный текст",
                        "h1" to "Заголовок 1",
                        "h2" to "Заголовок 2",
                        "h3" to "Заголовок 3",
                    )) DropdownMenuItem(
                    text = { Text(title) },
                    onClick = {
                        more = false
                        format(key)
                    },
                )
                DropdownMenuItem(
                    text = { Text("Ссылка") },
                    onClick = {
                        more = false
                        link()
                    },
                )
                val objects =
                    listOf(
                        RichObject("<ol><li></li></ol>", "Нумерованный список", true),
                        RichObject("<pre><code></code></pre>", "Блок кода", true),
                        RichObject(
                            "<table><tbody><tr><td></td><td></td></tr><tr><td></td><td></td></tr></tbody></table>",
                            "Таблица",
                            true,
                        ),
                        RichObject("<img src=\"\" alt=\"\">", "Изображение", false),
                    )
                objects.forEach { value ->
                    DropdownMenuItem(
                        text = { Text(value.label) },
                        onClick = {
                            more = false
                            insert(value)
                        },
                    )
                }
                Column {
                    insertActions { html, title, block ->
                        more = false
                        insert(RichObject(html, title, block))
                    }
                }
                DropdownMenuItem(
                    text = { Text("Изменить встроенный элемент") },
                    onClick = {
                        more = false
                        editObject()
                    },
                )
            }
        }
    }
}

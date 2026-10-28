package ru.dndshare.client.ui.designsystem.richtext

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun RichListDialog(value: RichObject, close: () -> Unit, save: (RichObject?) -> Unit) {
    val model = remember(value) { RichListModel(value.html) }
    var start by remember { mutableIntStateOf(0) }
    var revision by remember { mutableIntStateOf(0) }
    val inputs = remember { ShareFormInputs() }
    fun change(action: () -> Unit) {
        inputs.flush()
        action()
        start = start.coerceIn(0, ((model.entries.size - 1).coerceAtLeast(0) / 10) * 10)
        revision++
    }
    CompositionLocalProvider(LocalShareFormInputs provides inputs) {
        ShareFormDialog(
            value.label,
            close,
            actions = {
                ShareTextButton({ save(null) }) {
                    Text("Удалить список", color = WebPalette.Danger)
                }
                ShareTextButton(close) { Text("Отмена") }
                ShareButton({
                    inputs.flush()
                    save(value.copy(html = model.html()))
                }) {
                    Text("Сохранить")
                }
            },
        ) {
            val entries = remember(revision) { model.entries.toList() }
            Row {
                ShareTextButton(
                    { change { start = (start - 10).coerceAtLeast(0) } },
                    enabled = start > 0,
                ) {
                    Text("Предыдущие")
                }
                ShareTextButton({ change { start += 10 } }, enabled = start + 10 < entries.size) {
                    Text("Следующие")
                }
            }
            entries.drop(start).take(10).forEachIndexed { index, entry ->
                key(entry.key) {
                    ShareRichTextInput(entry.html, { entry.html = it }, "Пункт ${start+index+1}")
                    Row {
                        ShareTextButton(
                            { change { model.move(entry.key, -1) } },
                            enabled = start + index > 0,
                        ) {
                            Text("Вверх")
                        }
                        ShareTextButton(
                            { change { model.move(entry.key, 1) } },
                            enabled = start + index < entries.lastIndex,
                        ) {
                            Text("Вниз")
                        }
                        ShareTextButton({ change { model.remove(entry.key) } }) {
                            Text("Удалить пункт")
                        }
                    }
                }
            }
            ShareTextButton({
                change {
                    model.add()
                    start = ((model.entries.size - 1) / 10) * 10
                }
            }) {
                Text("Добавить пункт")
            }
        }
    }
}

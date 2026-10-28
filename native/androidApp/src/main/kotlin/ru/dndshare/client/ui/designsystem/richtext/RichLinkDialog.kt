package ru.dndshare.client.ui.designsystem.richtext

import androidx.compose.material3.*
import androidx.compose.runtime.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun RichLinkDialog(
    initialUrl: String,
    initialTitle: String,
    close: () -> Unit,
    clear: () -> Unit,
    hasLink: Boolean,
    save: (String, String) -> Unit,
) {
    var url by remember { mutableStateOf(initialUrl) }
    var title by remember { mutableStateOf(initialTitle) }
    var error by remember { mutableStateOf<String?>(null) }
    val inputs = remember { ShareFormInputs() }
    CompositionLocalProvider(LocalShareFormInputs provides inputs) {
        ShareFormDialog(
            "Ссылка",
            close,
            actions = {
                if (hasLink)
                    ShareTextButton(clear) { Text("Убрать ссылку", color = WebPalette.Danger) }
                ShareTextButton(close) { Text("Отмена") }
                ShareButton(
                    onClick = {
                        inputs.flush()
                        if (!Regex("^(https?://|mailto:).+", RegexOption.IGNORE_CASE).matches(url))
                            error = "Укажите адрес https://, http:// или mailto:."
                        else save(url, title)
                    }
                ) {
                    Text("Добавить")
                }
            },
        ) {
            ShareTextInput(url, { url = it }, "Адрес")
            ShareTextInput(title, { title = it }, "Текст ссылки")
            error?.let { Text(it, color = WebPalette.Danger) }
        }
    }
}

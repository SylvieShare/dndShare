package ru.dndshare.client.ui.designsystem.richtext

import androidx.compose.runtime.*
import androidx.compose.ui.Modifier

/** Nested list/table editors inherit the host's typed insertion and object-editing slots. */
private data class RichTextExtensions(
    val insert: @Composable ((String, String, Boolean) -> Unit) -> Unit = {},
    val editor: (@Composable (String, () -> Unit, (String?) -> Unit) -> Unit)? = null,
)

private val LocalRichTextExtensions = staticCompositionLocalOf { RichTextExtensions() }

@Composable
fun ShareRichTextInput(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    insertActions: (@Composable ((String, String, Boolean) -> Unit) -> Unit)? = null,
    embeddedEditor: (@Composable (String, () -> Unit, (String?) -> Unit) -> Unit)? = null,
) {
    val parent = LocalRichTextExtensions.current
    val extensions =
        RichTextExtensions(insertActions ?: parent.insert, embeddedEditor ?: parent.editor)
    CompositionLocalProvider(LocalRichTextExtensions provides extensions) {
        RichTextInputContent(
            value,
            onValueChange,
            label,
            modifier,
            enabled,
            extensions.insert,
            extensions.editor,
        )
    }
}

package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

/** Native modal with a fixed title/footer, scrolling form and deliberate keyboard focus. */
@Composable
fun ShareFormDialog(
    title: String,
    close: () -> Unit,
    dismissEnabled: Boolean = true,
    actions: @Composable RowScope.() -> Unit = {
        TextButton(onClick = close, enabled = dismissEnabled) { Text("Закрыть") }
    },
    content: @Composable ColumnScope.() -> Unit,
) {
    val focus = remember { FocusRequester() }
    Dialog(
        onDismissRequest = { if (dismissEnabled) close() },
        properties =
            DialogProperties(
                usePlatformDefaultWidth = false,
                dismissOnBackPress = dismissEnabled,
                dismissOnClickOutside = dismissEnabled,
            ),
    ) {
        Surface(
            Modifier.widthIn(max = 760.dp)
                .fillMaxWidth()
                .padding(12.dp)
                .imePadding()
                .heightIn(max = 900.dp)
                .focusRequester(focus)
                .focusable(),
            color = WebPalette.Surface,
            shape = MaterialTheme.shapes.large,
        ) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(title, style = ShareTypography.section)
                Column(
                    Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    content = content,
                )
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement =
                        Arrangement.spacedBy(8.dp, androidx.compose.ui.Alignment.End),
                    content = actions,
                )
            }
        }
        LaunchedEffect(Unit) { focus.requestFocus() }
    }
}

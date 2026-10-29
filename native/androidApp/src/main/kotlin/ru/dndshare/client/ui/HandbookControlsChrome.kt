package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import ru.dndshare.client.ui.designsystem.*

/** Use the same pane geometry as the content; the detail keeps the main header's inset. */
@Composable
internal fun HandbookControlsChrome(
    format: LayoutFormat,
    fold: FoldInfo?,
    content: @Composable () -> Unit,
) {
    val density = LocalDensity.current
    var origin by remember { mutableStateOf(Offset.Zero) }
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        BoxWithConstraints(
            Modifier.widthIn(max = DesignTokens.Layout.ContentMax)
                .fillMaxWidth()
                .padding(
                    horizontal =
                        if (format == LayoutFormat.Wide) DesignTokens.Spacing.Page else 0.dp
                )
                .onGloballyPositioned { origin = it.positionInWindow() }
        ) {
            val stacked = fold?.let { it.separating && !it.vertical } == true
            val width =
                if (format == LayoutFormat.Phone || stacked) maxWidth
                else paneColumns(maxWidth, fold, origin.x, density).first
            ShareSubheader(Modifier.width(width), content = content)
        }
    }
}

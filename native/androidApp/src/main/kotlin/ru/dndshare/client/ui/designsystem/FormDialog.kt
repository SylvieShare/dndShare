package ru.dndshare.client.ui.designsystem

import androidx.compose.foundation.BorderStroke

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.dialog
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.ui.window.DialogWindowProvider

@Composable
fun ShareFormDialog(
    title: String,
    close: () -> Unit,
    dismissEnabled: Boolean = true,
    actions: @Composable RowScope.() -> Unit = {
        ShareTextButton(onClick = close, enabled = dismissEnabled) { Text("Закрыть") }
    },
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    ShareWindow(
        onDismissRequest = close,
        modifier = modifier,
        dismissEnabled = dismissEnabled,
        title = { Text(title, style = ShareTypography.header) },
        actions = actions,
        content = content,
    )
}

/** One owned window frame for app forms and confirmations; system pickers stay native. */
@Composable
fun ShareWindow(
    onDismissRequest: () -> Unit,
    title: (@Composable () -> Unit)?,
    modifier: Modifier = Modifier,
    dismissEnabled: Boolean = true,
    actions: @Composable RowScope.() -> Unit = {},
    scrollContent: Boolean = true,
    separateHeader: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    RegisterWindowBackdrop(8.dp)
    val focus = remember { FocusRequester() }
    Dialog(
        onDismissRequest = { if (dismissEnabled) onDismissRequest() },
        properties =
            DialogProperties(
                usePlatformDefaultWidth = false,
                dismissOnBackPress = dismissEnabled,
                dismissOnClickOutside = dismissEnabled,
            ),
    ) {
        ApplyWindowBackdrop(8.dp, WebPalette.Scrim.alpha)
        Surface(
            modifier
                .widthIn(max = 760.dp)
                .fillMaxWidth()
                .padding(12.dp)
                .imePadding()
                .heightIn(max = 900.dp)
                .focusRequester(focus)
                .focusable()
                .semantics { dialog() },
            color = WebPalette.Surface,
            shape = RoundedCornerShape(18.dp),
            shadowElevation = 20.dp,
            border = BorderStroke(DesignTokens.Layout.Border, WebPalette.BorderStrong),
        ) {
            val framePadding = if (separateHeader) PaddingValues(bottom = 18.dp) else PaddingValues(18.dp)
            Column(Modifier.padding(framePadding), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Column {
                    val header = if (separateHeader)
                        Modifier.heightIn(min = 58.dp).padding(start = 24.dp, end = 6.dp)
                    else Modifier
                    Row(Modifier.fillMaxWidth().then(header), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.weight(1f)) {
                            ProvideTextStyle(ShareTypography.header) { title?.invoke() }
                        }
                        if (separateHeader) VerticalDivider(Modifier.padding(start = 8.dp).height(20.dp), color = WebPalette.BorderStrong)
                        IconButton(
                            onClick = onDismissRequest,
                            enabled = dismissEnabled,
                            modifier = Modifier.semantics { contentDescription = "Закрыть окно" },
                        ) {
                            AppGlyph(Glyph.Close, Modifier.size(18.dp))
                        }
                    }
                    if (separateHeader) HorizontalDivider(color = WebPalette.Border)
                }
                Column(
                    Modifier.padding(horizontal = if (separateHeader) 18.dp else 0.dp).weight(1f, fill = false)
                        .then(
                            if (scrollContent) Modifier.verticalScroll(rememberScrollState())
                            else Modifier
                        ),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    content = content,
                )
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
                    content = actions,
                )
            }
        }
        LaunchedEffect(Unit) { focus.requestFocus() }
    }
}

@Composable
fun ShareAlertDialog(
    onDismissRequest: () -> Unit,
    confirmButton: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    dismissButton: (@Composable () -> Unit)? = null,
    title: (@Composable () -> Unit)? = null,
    text: (@Composable () -> Unit)? = null,
    icon: (@Composable () -> Unit)? = null,
) {
    ShareWindow(
        onDismissRequest,
        title,
        modifier,
        actions = {
            dismissButton?.invoke()
            confirmButton()
        },
    ) {
        icon?.invoke()
        text?.invoke()
    }
}

@Composable
fun ShareFullscreenDialog(
    onDismissRequest: () -> Unit,
    properties: DialogProperties = DialogProperties(usePlatformDefaultWidth = false),
    dimAmount: Float? = null,
    blurBehind: Dp = 0.dp,
    content: @Composable () -> Unit,
) {
    RegisterWindowBackdrop(blurBehind)
    Dialog(
        onDismissRequest,
        properties =
            DialogProperties(
                dismissOnBackPress = properties.dismissOnBackPress,
                dismissOnClickOutside = properties.dismissOnClickOutside,
                securePolicy = properties.securePolicy,
                usePlatformDefaultWidth = false,
                decorFitsSystemWindows = false,
            ),
    ) {
        val view = LocalView.current
        ApplyWindowBackdrop(blurBehind, dimAmount)
        SideEffect {
            (view.parent as? DialogWindowProvider)?.window?.let { window ->
                @Suppress("DEPRECATION")
                run {
                    window.statusBarColor = android.graphics.Color.TRANSPARENT
                    window.navigationBarColor = android.graphics.Color.TRANSPARENT
                }
                if (android.os.Build.VERSION.SDK_INT >= 29) {
                    window.isNavigationBarContrastEnforced = false
                    window.isStatusBarContrastEnforced = false
                }
                androidx.core.view.WindowCompat.getInsetsController(window, view).apply {
                    isAppearanceLightStatusBars = false
                    isAppearanceLightNavigationBars = false
                }
            }
        }
        CompositionLocalProvider(
            LocalChromePadding provides WindowInsets.safeDrawing.asPaddingValues()
        ) {
            content()
        }
    }
}

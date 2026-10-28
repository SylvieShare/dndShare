package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.*
import androidx.compose.animation.core.MutableTransitionState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.*
import androidx.compose.ui.window.*

private val LocalMenuInteractive = staticCompositionLocalOf { true }

private class MenuPosition(private val margin: Int) : PopupPositionProvider {
    override fun calculatePosition(
        anchorBounds: IntRect,
        windowSize: IntSize,
        layoutDirection: LayoutDirection,
        popupContentSize: IntSize,
    ): IntOffset {
        val x =
            if (layoutDirection == LayoutDirection.Ltr) anchorBounds.right - popupContentSize.width
            else anchorBounds.left
        val below = anchorBounds.bottom + margin / 2
        val y =
            if (below + popupContentSize.height <= windowSize.height - margin) below
            else anchorBounds.top - popupContentSize.height - margin / 2
        return IntOffset(
            x.coerceIn(margin, maxOf(margin, windowSize.width - popupContentSize.width - margin)),
            y.coerceIn(margin, maxOf(margin, windowSize.height - popupContentSize.height - margin)),
        )
    }
}

@Composable
fun ShareDropdownMenu(
    expanded: Boolean,
    onDismissRequest: () -> Unit,
    modifier: Modifier = Modifier,
    containerColor: Color = WebPalette.Popover,
    content: @Composable ColumnScope.() -> Unit,
) {
    val transition = remember { MutableTransitionState(false) }
    transition.targetState = expanded
    val density = androidx.compose.ui.platform.LocalDensity.current
    val position = remember(density) { MenuPosition(with(density) { 8.dp.roundToPx() }) }
    val maximumWidth =
        minOf(360.dp, (LocalConfiguration.current.screenWidthDp.dp - 16.dp).coerceAtLeast(1.dp))
    val maximumHeight = (LocalConfiguration.current.screenHeightDp.dp - 32.dp).coerceAtLeast(80.dp)
    if (transition.currentState || transition.targetState)
        Popup(
            popupPositionProvider = position,
            onDismissRequest = onDismissRequest,
            properties = PopupProperties(focusable = expanded, dismissOnClickOutside = expanded),
        ) {
            AnimatedVisibility(
                transition,
                enter = fadeIn() + scaleIn(initialScale = .96f),
                exit = fadeOut() + scaleOut(targetScale = .98f),
            ) {
                Surface(
                    modifier
                        .widthIn(min = minOf(160.dp, maximumWidth), max = maximumWidth)
                        .heightIn(max = maximumHeight),
                    shape = RoundedCornerShape(10.dp),
                    color = containerColor,
                    shadowElevation = 16.dp,
                ) {
                    CompositionLocalProvider(
                        LocalMenuInteractive provides expanded,
                        LocalTextStyle provides fieldTextStyle,
                    ) {
                        Column(
                            Modifier.padding(6.dp)
                                .width(IntrinsicSize.Max)
                                .verticalScroll(rememberScrollState()),
                            content = content,
                        )
                    }
                }
            }
        }
}

@Composable
fun ShareDropdownMenuItem(
    text: @Composable () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    leadingIcon: (@Composable () -> Unit)? = null,
    trailingIcon: (@Composable () -> Unit)? = null,
    enabled: Boolean = true,
) {
    val interactive = enabled && LocalMenuInteractive.current
    Surface(
        onClick = onClick,
        enabled = interactive,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(6.dp),
        color = Color.Transparent,
        contentColor = if (enabled) WebPalette.Text else WebPalette.TextMuted.copy(alpha = .5f),
    ) {
        Row(
            Modifier.heightIn(min = 40.dp).padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            leadingIcon?.invoke()
            Box(Modifier.weight(1f)) {
                CompositionLocalProvider(LocalTextStyle provides fieldTextStyle) { text() }
            }
            trailingIcon?.invoke()
        }
    }
}

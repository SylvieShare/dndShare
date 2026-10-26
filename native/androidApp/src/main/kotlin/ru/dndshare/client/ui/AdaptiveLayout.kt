package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import ru.dndshare.designsystem.DesignTokens
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp

enum class LayoutFormat { Phone, Tablet, Wide }

fun layoutFormat(widthDp: Float): LayoutFormat = when {
    widthDp < DesignTokens.Layout.Tablet.value -> LayoutFormat.Phone
    widthDp < DesignTokens.Layout.Desktop.value -> LayoutFormat.Tablet
    else -> LayoutFormat.Wide
}

data class FoldInfo(
    val left: Int, val top: Int, val right: Int, val bottom: Int,
    val vertical: Boolean, val separating: Boolean,
)

@Composable
fun TwoPane(
    fold: FoldInfo?,
    modifier: Modifier = Modifier,
    primary: @Composable () -> Unit,
    detail: @Composable () -> Unit,
) {
    var offset by remember { mutableStateOf(Offset.Zero) }
    val density = LocalDensity.current
    BoxWithConstraints(modifier.onGloballyPositioned { offset = it.positionInWindow() }) {
        val hinge = fold?.takeIf { it.separating }
        if (hinge != null && !hinge.vertical) {
            val topHeight = with(density) { (hinge.top - offset.y).toDp() }
            val gap = with(density) { (hinge.bottom - hinge.top).toDp() }.coerceAtLeast(16.dp)
            if (topHeight >= 160.dp && maxHeight - topHeight - gap >= 200.dp) {
                Column {
                    Box(Modifier.fillMaxWidth().height(topHeight - 8.dp)) { primary() }
                    Spacer(Modifier.height(gap))
                    Box(Modifier.fillMaxWidth().weight(1f)) { detail() }
                }
                return@BoxWithConstraints
            }
        }
        val hingeLeft = hinge?.takeIf { it.vertical }?.let { with(density) { (it.left - offset.x).toDp() } }
        val gap = hinge?.takeIf { it.vertical }?.let {
            with(density) { (it.right - it.left).toDp() }.coerceAtLeast(16.dp)
        } ?: 1.dp
        val listWidth = if (hingeLeft != null && hingeLeft >= 220.dp && maxWidth - hingeLeft - gap >= 260.dp) {
            hingeLeft - 8.dp
        } else (maxWidth * .40f).coerceIn(220.dp, 400.dp)
        Row(Modifier.fillMaxSize()) {
            Box(Modifier.width(listWidth).fillMaxHeight()) { primary() }
            Spacer(Modifier.width(gap))
            Box(Modifier.weight(1f).fillMaxHeight()) { detail() }
        }
    }
}

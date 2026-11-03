package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*

/** share-ui SlidingTabs underline variant, including native selection semantics and scrolling. */
@Composable
fun ShareSlidingTabs(
    items: List<ShareNavigationItem>,
    selected: String,
    onSelect: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
) {
    val compact = LocalConfiguration.current.screenWidthDp <= 640
    val gap = if (compact) 18.dp else 28.dp
    val padding = if (compact) 16.dp else 20.dp
    val widths = remember { mutableStateMapOf<String, Dp>() }
    val index = items.indexOfFirst { it.key == selected }.coerceAtLeast(0)
    val target =
        padding +
            items.take(index).fold(0.dp) { sum, item -> sum + (widths[item.key] ?: 0.dp) } +
            gap * index
    val left by animateDpAsState(target, label = "Tab underline position")
    val width by animateDpAsState(widths[selected] ?: 0.dp, label = "Tab underline width")
    val density = LocalDensity.current
    val scroll = rememberScrollState()
    var viewport by remember { mutableIntStateOf(0) }
    LaunchedEffect(selected, target, widths[selected], viewport) {
        val start = with(density) { target.roundToPx() }
        val end = with(density) { (target + (widths[selected] ?: 0.dp) + padding).roundToPx() }
        val desired =
            if (start < scroll.value) start
            else if (end > scroll.value + viewport) end - viewport else scroll.value
        scroll.animateScrollTo(desired.coerceIn(0, scroll.maxValue))
    }
    Box(
        modifier
            .onSizeChanged { viewport = it.width }
            .horizontalScroll(scroll)
            .selectableGroup()
            .semantics { contentDescription = label }
    ) {
        Row(
            Modifier.height(44.dp).padding(horizontal = padding),
            horizontalArrangement = Arrangement.spacedBy(gap),
        ) {
            for (item in items) Box(
                Modifier.onSizeChanged { widths[item.key] = with(density) { it.width.toDp() } }
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(6.dp))
                    .selectable(
                        item.key == selected,
                        role = Role.Tab,
                        onClick = { onSelect(item.key) },
                    )
                    .padding(horizontal = 4.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    item.label,
                    color = if (item.key == selected) WebPalette.Text else WebPalette.TextMuted,
                    style =
                        ShareTypography.context.copy(
                            fontSize = if (compact) 12.sp else 14.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = .28.sp,
                        ),
                    maxLines = 1,
                )
            }
        }
        Box(
            Modifier.align(Alignment.BottomStart)
                .offset(x = left, y = (-5).dp)
                .width(width)
                .height(3.dp)
                .background(WebPalette.Accent, RoundedCornerShape(50))
        )
    }
}

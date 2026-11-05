package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.sp

data class ShareNavigationItem(val key: String, val label: String)

@Composable
fun ShareIconNavigation(
    items: List<ShareNavigationItem>,
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
    showSelectedLabel: Boolean = false,
    selectedItemSize: Dp = 84.dp,
    pill: Boolean = false,
    itemSize: Dp = 56.dp,
    containerColor: Color = WebPalette.Subheader,
    itemHeight: Dp = itemSize,
    cornerRadius: Dp? = null,
    visualPosition: (() -> Float)? = null,
    icon: @Composable (String) -> Unit,
) {
    val itemShape = cornerRadius?.let { RoundedCornerShape(it) }
        ?: if (pill) RoundedCornerShape(percent = 50) else RoundedCornerShape(10.dp)
    BoxWithConstraints(if (compact) modifier.fillMaxWidth() else modifier) {
        val gap = 2.dp
        val horizontalPadding = if (compact) 8.dp else 4.dp
        val extra = if (compact && showSelectedLabel) (selectedItemSize - 44.dp).coerceAtLeast(0.dp) else 0.dp
        val size =
            if (compact && items.isNotEmpty())
                ((maxWidth - horizontalPadding * 2 - gap * (items.size - 1) - extra) / items.size)
                    .coerceAtLeast(44.dp)
            else itemSize
        val density = LocalDensity.current
        val captionHeight = with(density) { 14.sp.toDp() }
        val height = if (compact) maxOf(40.dp, if (showSelectedLabel) 26.dp + captionHeight else 40.dp) else itemHeight
        val index = items.indexOfFirst { it.key == selected }.coerceAtLeast(0)
        // The pager already animates release/cancellation. A second animation would lag behind it.
        val standalonePosition by animateFloatAsState(index.toFloat(), tween(DesignTokens.Motion.Navigation), label = "Navigation selection")
        val position = visualPosition?.invoke() ?: standalonePosition
        val frame = navigationFrame(items.size, position, size.value, extra.value, gap.value)
        val scroll = rememberScrollState()
        val latestFrame by rememberUpdatedState(frame)
        LaunchedEffect(compact, maxWidth, items.size, scroll.maxValue) {
            if (compact) snapshotFlow { latestFrame }.collect { current ->
                val start = with(density) { current.indicatorX.dp.roundToPx() }
                val end = with(density) { (current.indicatorX.dp + current.indicatorWidth.dp + horizontalPadding * 2).roundToPx() }
                val viewport = with(density) { maxWidth.roundToPx() }
                // Read scroll.value outside snapshotFlow so manually scrolling the strip stays possible.
                val target = when {
                    start < scroll.value -> start
                    end > scroll.value + viewport -> end - viewport
                    else -> scroll.value
                }.coerceIn(0, scroll.maxValue)
                if (target != scroll.value) scroll.scrollTo(target)
            }
        }
        Box(
            Modifier.horizontalScroll(scroll)
                .padding(horizontal = horizontalPadding, vertical = 4.dp)
                .selectableGroup()
        ) {
            if (compact && !pill)
                Box(
                    Modifier.offset { IntOffset(frame.indicatorX.dp.roundToPx(), (height - 3.dp).roundToPx()) }
                        .width(frame.indicatorWidth.dp)
                        .height(3.dp)
                        .background(WebPalette.Accent, RoundedCornerShape(5.dp))
                )
            else
                Box(
                    Modifier.offset { IntOffset(frame.indicatorX.dp.roundToPx(), 0) }
                        .width(frame.indicatorWidth.dp)
                        .height(height)
                        .background(
                            if (pill)
                                WebPalette.Accent.copy(alpha = .18f)
                                    .compositeOver(containerColor)
                            else WebPalette.Accent,
                            itemShape,
                        )
                )
            Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                items.forEachIndexed { itemIndex, item ->
                    val itemFrame = frame.items[itemIndex]
                    val tint = lerp(WebPalette.TextMuted, if (pill) WebPalette.AccentSoft else WebPalette.OnAccent, itemFrame.weight)
                    val interactions = remember(item.key) { MutableInteractionSource() }
                    Box(
                        Modifier.width(itemFrame.width.dp)
                            .height(height)
                            .selectable(
                                item.key == selected,
                                interactionSource = interactions,
                                indication = null,
                                role = Role.Tab,
                                onClick = { onSelect(item.key) },
                            )
                            .semantics { contentDescription = item.label }
                    ) {
                        CompositionLocalProvider(LocalContentColor provides tint) {
                            if (compact) {
                                Box(Modifier.align(Alignment.Center).offset(y = -captionHeight / 2 * if (showSelectedLabel) itemFrame.weight else 0f)) {
                                    icon(item.key)
                                }
                                if (showSelectedLabel) Text(
                                    item.label,
                                    Modifier.align(Alignment.BottomCenter).padding(bottom = 2.dp)
                                        .graphicsLayer { alpha = itemFrame.weight }
                                        .clearAndSetSemantics {},
                                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                                    fontSize = 10.sp, lineHeight = 14.sp,
                                    letterSpacing = 0.sp, fontWeight = FontWeight.Bold, color = tint,
                                )
                            } else Column(
                                Modifier.fillMaxSize(),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center,
                            ) {
                                icon(item.key)
                                Text(item.label, maxLines = 1, overflow = TextOverflow.Ellipsis,
                                    fontSize = 10.sp, lineHeight = 14.sp, letterSpacing = 0.sp,
                                    fontWeight = FontWeight.Bold, color = tint)
                            }
                        }
                        Box(
                            Modifier.matchParentSize()
                                .clip(itemShape)
                                .indication(interactions, LocalIndication.current)
                        )
                    }
                }
            }
        }
    }
}

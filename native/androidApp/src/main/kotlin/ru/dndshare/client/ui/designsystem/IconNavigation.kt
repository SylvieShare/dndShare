package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.*
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class ShareNavigationItem(val key: String, val label: String)

@Composable
fun ShareIconNavigation(
    items: List<ShareNavigationItem>,
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
    pill: Boolean = false,
    icon: @Composable (String) -> Unit,
) {
    BoxWithConstraints(if (compact) modifier.fillMaxWidth() else modifier) {
        val gap = 2.dp
        val horizontalPadding = if (compact) 8.dp else 4.dp
        val size =
            if (compact && items.isNotEmpty())
                ((maxWidth - horizontalPadding * 2 - gap * (items.size - 1)) / items.size)
                    .coerceAtLeast(44.dp)
            else 56.dp
        val height = if (compact) 40.dp else 56.dp
        val index = items.indexOfFirst { it.key == selected }.coerceAtLeast(0)
        val x = animateDpAsState((size + gap) * index, label = "Navigation indicator")
        val scroll = rememberScrollState()
        val density = LocalDensity.current
        LaunchedEffect(selected, maxWidth, scroll.maxValue) {
            if (compact) {
                val start = with(density) { ((size + gap) * index).roundToPx() }
                val end =
                    with(density) {
                        ((size + gap) * index + size + horizontalPadding * 2).roundToPx()
                    }
                val viewport = with(density) { maxWidth.roundToPx() }
                val target =
                    when {
                        start < scroll.value -> start
                        end > scroll.value + viewport -> end - viewport
                        else -> scroll.value
                    }
                scroll.animateScrollTo(target.coerceIn(0, scroll.maxValue))
            }
        }
        Box(
            Modifier.horizontalScroll(scroll)
                .padding(horizontal = horizontalPadding, vertical = 4.dp)
                .selectableGroup()
        ) {
            if (compact && !pill)
                Box(
                    Modifier.offset { IntOffset(x.value.roundToPx(), (height - 3.dp).roundToPx()) }
                        .width(size)
                        .height(3.dp)
                        .background(WebPalette.Accent, RoundedCornerShape(5.dp))
                )
            else
                Box(
                    Modifier.offset { IntOffset(x.value.roundToPx(), 0) }
                        .width(size)
                        .height(height)
                        .background(
                            if (pill)
                                WebPalette.Accent.copy(alpha = .18f)
                                    .compositeOver(WebPalette.Subheader)
                            else WebPalette.Accent,
                            if (pill) RoundedCornerShape(percent = 50)
                            else RoundedCornerShape(10.dp),
                        )
                )
            Row(horizontalArrangement = Arrangement.spacedBy(gap)) {
                items.forEach { item ->
                    val interactions = remember(item.key) { MutableInteractionSource() }
                    Box(
                        Modifier.width(size)
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
                        Column(
                            Modifier.fillMaxSize(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                        ) {
                            icon(item.key)
                            if (!compact)
                                Text(
                                    item.label,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    fontSize = 10.sp,
                                    lineHeight = 14.sp,
                                    letterSpacing = 0.sp,
                                    fontWeight = FontWeight.Bold,
                                    color =
                                        if (item.key == selected)
                                            if (pill) WebPalette.AccentSoft else WebPalette.OnAccent
                                        else WebPalette.TextMuted,
                                )
                        }
                        Box(
                            Modifier.matchParentSize()
                                .clip(
                                    if (pill) RoundedCornerShape(50) else RoundedCornerShape(10.dp)
                                )
                                .indication(interactions, LocalIndication.current)
                        )
                    }
                }
            }
        }
    }
}

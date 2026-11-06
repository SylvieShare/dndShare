package ru.dndshare.client.ui.designsystem

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.*
import kotlin.math.abs

internal data class IconSegment(val key: String, val label: String, val glyph: Glyph)

/** Fixed segments only move/tint their layers. Text and touch targets keep their measured layout. */
@Composable
internal fun ShareIconSegmentedInput(
    options: List<IconSegment>,
    selected: String,
    enabled: Boolean,
    itemWidth: Dp,
    itemHeight: Dp,
    onSelect: (String) -> Unit,
) {
    val index = options.indexOfFirst { it.key == selected }.coerceAtLeast(0)
    val progress = animateFloatAsState(index.toFloat(), tween(DesignTokens.Motion.Navigation), label = "Segment selection")
    val gap = 2.dp
    val direction = if (LocalLayoutDirection.current == LayoutDirection.Rtl) -1 else 1
    val shape = RoundedCornerShape(10.dp)
    Box(Modifier.horizontalScroll(rememberScrollState()).padding(4.dp)) {
        Box(Modifier.size(itemWidth, itemHeight)
            .graphicsLayer { translationX = direction * (itemWidth + gap).toPx() * progress.value }
            .background(WebPalette.Accent, shape))
        Row(Modifier.selectableGroup(), horizontalArrangement = Arrangement.spacedBy(gap)) {
            options.forEachIndexed { i, option ->
                Box(Modifier.size(itemWidth, itemHeight).clip(shape)
                    .selectable(option.key == selected, enabled = enabled, role = Role.RadioButton) { onSelect(option.key) }
                    .semantics { contentDescription = option.label }, contentAlignment = Alignment.Center) {
                    Column(
                        Modifier.clearAndSetSemantics {}.graphicsLayer {
                            val weight = (1f - abs(progress.value - i)).coerceIn(0f, 1f)
                            colorFilter = ColorFilter.tint(lerp(WebPalette.TextMuted, WebPalette.OnAccent, weight))
                        },
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        AppGlyph(option.glyph, tint = Color.White)
                        Text(option.label, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis,
                            fontSize = 10.sp, lineHeight = 14.sp, letterSpacing = 0.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

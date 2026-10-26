package ru.dndshare.designsystem

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.unit.dp

@Composable
fun ShareContentRow(
    title: String, alternate: String, subtitle: String, selected: Boolean, onClick: () -> Unit,
    modifier: Modifier = Modifier, metric: String = "", metricColor: Color = WebPalette.AccentSoft,
    icon: @Composable () -> Unit = {}, trailing: @Composable RowScope.() -> Unit = {},
) {
    val background by animateColorAsState(if (selected) WebPalette.Accent.copy(alpha = .20f).compositeOver(WebPalette.Active)
        else WebPalette.Surface, tween(DesignTokens.Motion.Feedback), label = "Row selection")
    val border by animateColorAsState(if (selected) WebPalette.Accent else WebPalette.Border,
        tween(DesignTokens.Motion.Feedback), label = "Row border")
    Surface(onClick, modifier.fillMaxWidth().semantics { this.selected = selected },
        shape = RoundedCornerShape(DesignTokens.Radius.Row), color = background, border = BorderStroke(1.dp, border)) {
        BoxWithConstraints {
            val alternateWidth = maxWidth * .28f
            val windowWidth = with(LocalDensity.current) { LocalWindowInfo.current.containerSize.width.toDp() }
            val metricWidth = (windowWidth * .045f).coerceIn(DesignTokens.List.MetricMin, DesignTokens.List.MetricMax) +
                (windowWidth * .005f).coerceAtMost(DesignTokens.List.MetricPaddingMax) * 2
            Row(Modifier.heightIn(min = DesignTokens.List.MinHeight).padding(end = DesignTokens.List.PaddingEnd),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(DesignTokens.List.Gap)) {
                Box(Modifier.size(DesignTokens.List.Icon), contentAlignment = Alignment.Center) { icon() }
                if (metric.isNotBlank()) Text(metric, Modifier.width(metricWidth), color = metricColor,
                    style = ShareTypography.listMetric, textAlign = TextAlign.Center, maxLines = 1)
                Column(Modifier.weight(1f).padding(vertical = 6.dp), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(title, Modifier.weight(1f, fill = false).alignByBaseline(), style = ShareTypography.row,
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (alternate.isNotBlank()) Text(alternate, Modifier.widthIn(max = alternateWidth).alignByBaseline(),
                            style = ShareTypography.listAlternate, color = WebPalette.TextMuted,
                            maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    if (subtitle.isNotBlank()) Text(subtitle, style = ShareTypography.listSubtitle,
                        color = WebPalette.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp), content = trailing)
                androidx.compose.runtime.CompositionLocalProvider(LocalContentColor provides WebPalette.TextMuted) {
                    AppGlyph(Glyph.Chevron, Modifier.size(14.dp))
                }
            }
        }
    }
}

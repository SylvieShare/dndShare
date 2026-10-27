package ru.dndshare.designsystem

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp

@Composable
fun ShareBadge(text: String, modifier: Modifier = Modifier, color: Color = WebPalette.AccentSoft) {
    Surface(modifier, color = color.copy(alpha = .13f), contentColor = color, shape = RoundedCornerShape(DesignTokens.Radius.Badge)) {
        Text(text, Modifier.padding(horizontal = 7.dp, vertical = 3.dp), style = MaterialTheme.typography.labelSmall)
    }
}

@Composable
fun ShareSection(label: String, modifier: Modifier = Modifier, count: Int? = null, prominent: Boolean = false,
    content: @Composable ColumnScope.() -> Unit) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(label, style = if (prominent) ShareTypography.section else ShareTypography.group)
            count?.let { ShareBadge(it.toString(), color = WebPalette.TextSecondary) }
            HorizontalDivider(Modifier.weight(1f))
        }
        content()
    }
}

@Composable
fun ShareDetailSection(label: String, collapsible: Boolean = false, defaultOpen: Boolean = true, content: @Composable ColumnScope.() -> Unit) {
    var open by rememberSaveable(label) { mutableStateOf(defaultOpen) }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(if (collapsible) Modifier.fillMaxWidth().heightIn(min = DesignTokens.Layout.TouchMin).clickable(role = Role.Button) { open = !open }
            .semantics { stateDescription = if (open) "Раскрыто" else "Свернуто" } else Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(label.uppercase(), style = MaterialTheme.typography.labelMedium, color = WebPalette.TextSecondary,
                fontWeight = FontWeight.Bold)
            HorizontalDivider(Modifier.weight(1f))
            if (collapsible) AppGlyph(Glyph.Chevron, Modifier.size(18.dp).rotate(if (open) 90f else 0f))
        }
        AnimatedVisibility(!collapsible || open) { Column(verticalArrangement = Arrangement.spacedBy(12.dp), content = content) }
    }
}

@Composable
fun ShareTile(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, tint: Color? = null,
    contentPadding: PaddingValues = PaddingValues(DesignTokens.Spacing.Large), accent: Color? = null,
    content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(DesignTokens.Radius.Tile)
    val border = BorderStroke(1.dp, WebPalette.Border)
    val glow = if (tint == null) Modifier else Modifier.drawWithCache {
        val brush = Brush.radialGradient(listOf(tint.copy(alpha = .12f), Color.Transparent),
            center = Offset(size.width * .72f, size.height * .35f), radius = size.width * .7f)
        onDrawBehind { drawRect(brush) }
    }
    val edge = if (accent == null) Modifier else Modifier.drawWithCache {
        val inset = 14.dp.toPx().coerceAtMost(size.height / 2)
        val stroke = 3.dp.toPx()
        onDrawWithContent {
            drawContent()
            drawLine(accent, Offset(stroke / 2, inset), Offset(stroke / 2, size.height - inset), stroke, StrokeCap.Round)
        }
    }
    if (onClick == null) Surface(modifier, shape = shape, border = border, color = WebPalette.Surface) {
        Column(glow.then(edge).padding(contentPadding), verticalArrangement = Arrangement.spacedBy(10.dp), content = content)
    } else Surface(onClick, modifier, shape = shape, border = border, color = WebPalette.Surface) {
        Column(glow.then(edge).padding(contentPadding), verticalArrangement = Arrangement.spacedBy(10.dp), content = content)
    }
}

data class ShareStat(val label: String, val value: String)

@Composable
fun ShareStats(stats: List<ShareStat>, modifier: Modifier = Modifier) {
    FlowRow(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        stats.forEach { stat ->
            Surface(Modifier.widthIn(min = 100.dp, max = 200.dp), shape = RoundedCornerShape(9.dp),
                color = WebPalette.Background.copy(alpha = .78f), border = BorderStroke(1.dp, WebPalette.BorderStrong)) {
                Column(Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(stat.label, style = MaterialTheme.typography.labelSmall, color = WebPalette.TextSecondary)
                    Text(stat.value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

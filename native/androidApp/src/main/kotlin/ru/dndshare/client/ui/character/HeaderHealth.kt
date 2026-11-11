package ru.dndshare.client.ui.character

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.*
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import coil3.ImageLoader
import coil3.compose.AsyncImage
import ru.dndshare.client.ui.designsystem.*

private val healthEasing = Easing { 1 - (1 - it) * (1 - it) * (1 - it) }

@Composable
internal fun HeaderHealth(current: Int, maximum: Int, temporary: Int, images: ImageLoader) {
    val target = if (maximum > 0) (current.toFloat() / maximum).coerceIn(0f, 1f) else 0f
    val tempTarget = if (maximum > 0) (temporary.toFloat() / maximum).coerceIn(0f, 1f - target) else 0f
    val color = when { target > .6f -> WebPalette.Success; target > .25f -> WebPalette.Warning; else -> WebPalette.Danger }
    val fill = animateFloatAsState(target, tween(DesignTokens.Motion.HealthFill, easing = healthEasing), label = "Health liquid")
    val temp = animateFloatAsState(tempTarget, tween(DesignTokens.Motion.HealthFill, easing = healthEasing), label = "Temporary health liquid")
    val echo = animateFloatAsState(target, tween(DesignTokens.Motion.HealthTrail, delayMillis = DesignTokens.Motion.HealthTrailDelay, easing = healthEasing), label = "Health trail")
    var visible by remember { mutableStateOf(false) }
    val phase = rememberVisualPhase(visible && (target > 0 || tempTarget > 0), DesignTokens.Motion.HealthCycle / 1000f, maxFps = 24, pauseOnFocusLoss = false)
    val baseStyle = ShareTypography.context.copy(lineHeight = ShareTypography.sheetHealth.lineHeight,
        shadow = Shadow(WebPalette.Background, Offset(0f, 1f), 3f))
    val label = buildAnnotatedString {
        withStyle(SpanStyle(color = WebPalette.Text, fontFamily = ShareTypography.sheetHealth.fontFamily, fontSize = ShareTypography.sheetHealth.fontSize,
            fontWeight = ShareTypography.sheetHealth.fontWeight, fontFeatureSettings = "'lnum', 'tnum'")) { append(current.toString()) }
        withStyle(SpanStyle(color = WebPalette.TextSecondary, fontSize = 12.sp)) { append(" / $maximum") }
    }
    val badgeStyle = ShareTypography.context.copy(fontSize = 12.sp, lineHeight = 18.sp, fontWeight = FontWeight.Bold,
        color = WebPalette.Info, fontFeatureSettings = "'tnum'")
    val measure = rememberTextMeasurer()
    val density = LocalDensity.current
    val textWidth = with(density) { measure.measure(label, style = baseStyle).size.width.toDp() }
    val badgeWidth = if (temporary > 0) with(density) { measure.measure("+$temporary", style = badgeStyle).size.width.toDp() } + 25.dp else 0.dp
    val shape = RoundedCornerShape(DesignTokens.Radius.Input)
    BoxWithConstraints(Modifier.fillMaxWidth().heightIn(min = DesignTokens.Layout.SheetHealthHeight)
        .onGloballyPositioned { visible = !it.boundsInWindow().isEmpty }
        .clip(shape).background(WebPalette.Background).border(1.dp, color, shape).clearAndSetSemantics {
            contentDescription = "Здоровье: $current из $maximum" + if (temporary > 0) ", временные $temporary" else ""
            progressBarRangeInfo = ProgressBarRangeInfo(target, 0f..1f)
        }, contentAlignment = Alignment.CenterStart) {
        val stacked = temporary > 0 && textWidth + DesignTokens.Layout.SheetHealthIcon + badgeWidth + 30.dp > maxWidth
        Canvas(Modifier.matchParentSize().padding(1.dp)) {
            drawHealthMist(fill.value, temp.value, echo.value, phase.value * 2 * kotlin.math.PI.toFloat(), color, WebPalette.Info,
                (kotlin.math.abs(target - fill.value) * 5).coerceAtMost(1f))
            val fadeWidth = (textWidth + DesignTokens.Layout.SheetHealthIcon + 38.dp).toPx().coerceAtLeast(1f)
            drawRect(Brush.horizontalGradient(0f to WebPalette.Background.copy(alpha = .84f),
                .6f to WebPalette.Background.copy(alpha = .65f), 1f to Color.Transparent, endX = fadeWidth))
        }
        val numbers: @Composable (Modifier) -> Unit = { modifier ->
            Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                AsyncImage("file:///android_asset/character-sheet/hp-pulse.svg", null, images,
                    colorFilter = ColorFilter.tint(lerp(color, WebPalette.Text, .45f)), modifier = Modifier.size(DesignTokens.Layout.SheetHealthIcon))
                Text(label, style = baseStyle, modifier = Modifier.weight(1f, fill = false))
            }
        }
        val badge: @Composable () -> Unit = {
            Row(Modifier.background(WebPalette.Info.copy(alpha = .18f).compositeOver(WebPalette.Background), RoundedCornerShape(DesignTokens.Radius.Xs))
                .padding(horizontal = 5.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                AppGlyph(Glyph.Shield, Modifier.size(12.dp), WebPalette.Info)
                Text("+$temporary", style = badgeStyle)
            }
        }
        val padding = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 2.dp)
        if (stacked) Column(padding, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            numbers(Modifier.fillMaxWidth())
            Box(Modifier.align(Alignment.End)) { badge() }
        } else Row(padding, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            numbers(Modifier.weight(1f))
            if (temporary > 0) badge()
        }
    }
}

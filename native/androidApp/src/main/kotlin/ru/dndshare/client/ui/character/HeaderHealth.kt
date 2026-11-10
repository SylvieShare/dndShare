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
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.*
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
    val phase = rememberVisualPhase(visible && (target > 0 || tempTarget > 0), DesignTokens.Motion.HealthCycle / 1000f, maxFps = 24)
    val baseStyle = ShareTypography.context.copy(lineHeight = ShareTypography.sheetHealth.lineHeight)
    val label = buildAnnotatedString {
        withStyle(SpanStyle(color = color, fontFamily = ShareTypography.sheetHealth.fontFamily, fontSize = ShareTypography.sheetHealth.fontSize,
            fontWeight = ShareTypography.sheetHealth.fontWeight, fontFeatureSettings = "'lnum', 'tnum'")) { append(current.toString()) }
        withStyle(SpanStyle(color = WebPalette.TextMuted, fontSize = 12.sp)) { append(" / $maximum") }
        if (temporary > 0) withStyle(SpanStyle(color = WebPalette.Info, fontSize = 12.sp)) { append(" +$temporary") }
    }
    val measure = rememberTextMeasurer()
    val textWidth = with(LocalDensity.current) { measure.measure(label, style = baseStyle).size.width.toDp() }
    BoxWithConstraints(Modifier.fillMaxWidth().clearAndSetSemantics {
        contentDescription = "Здоровье: $current из $maximum" + if (temporary > 0) ", временные $temporary" else ""
        progressBarRangeInfo = ProgressBarRangeInfo(target, 0f..1f)
    }) {
        val stacked = textWidth + DesignTokens.Layout.SheetHealthIcon + 14.dp + 40.dp > maxWidth
        val numbers: @Composable () -> Unit = {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                AsyncImage("file:///android_asset/character-sheet/hp-pulse.svg", null, images,
                    colorFilter = ColorFilter.tint(color), modifier = Modifier.size(DesignTokens.Layout.SheetHealthIcon))
                Text(label, style = baseStyle, modifier = Modifier.weight(1f, fill = false))
            }
        }
        val bar: @Composable (Modifier) -> Unit = { modifier ->
            Canvas(modifier.height(DesignTokens.Layout.SheetHealthHeight).onGloballyPositioned { visible = !it.boundsInWindow().isEmpty }
                .clip(RoundedCornerShape(DesignTokens.Radius.Input)).background(WebPalette.Background)
                .border(1.dp, color, RoundedCornerShape(DesignTokens.Radius.Input)).padding(1.dp)) {
                drawHealthMist(fill.value, temp.value, echo.value, phase.value * 2 * kotlin.math.PI.toFloat(), color, WebPalette.Info)
            }
        }
        if (stacked) Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            numbers()
            bar(Modifier.fillMaxWidth())
        } else Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            numbers()
            bar(Modifier.weight(1f))
        }
    }
}

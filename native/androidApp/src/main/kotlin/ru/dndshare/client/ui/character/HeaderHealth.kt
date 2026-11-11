package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun HeaderHealth(current: Int, maximum: Int, temporary: Int, images: ImageLoader) {
    val fraction = if (maximum > 0) (current.toFloat() / maximum).coerceIn(0f, 1f) else 0f
    val extra = if (maximum > 0) (temporary.toFloat() / maximum).coerceIn(0f, 1f - fraction) else 0f
    val color = when { fraction > .6f -> WebPalette.Success; fraction > .25f -> WebPalette.Warning; else -> WebPalette.Danger }
    val label = buildAnnotatedString {
        append(current.toString())
        withStyle(SpanStyle(fontFamily = ShareTypography.context.fontFamily, fontSize = ShareTypography.context.fontSize,
            fontWeight = ShareTypography.context.fontWeight, color = WebPalette.TextMuted)) { append("/$maximum") }
    }
    Row(Modifier.fillMaxWidth().clearAndSetSemantics {
        contentDescription = "Здоровье: $current из $maximum" + if (temporary > 0) ", временные $temporary" else ""
    }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            AsyncImage("file:///android_asset/character-sheet/hp-pulse.svg", null, images,
                colorFilter = ColorFilter.tint(color), modifier = Modifier.size(DesignTokens.Layout.SheetHealthIcon))
            Text(label, style = ShareTypography.sheetHealth.copy(color = WebPalette.Text, fontFeatureSettings = "'lnum', 'tnum'"))
        }
        HpBar(fraction, extra, color, Modifier.weight(1f), DesignTokens.Layout.SheetHealthTrackHeight)
        if (temporary > 0) Text("+$temporary", style = ShareTypography.context.copy(fontWeight = FontWeight.SemiBold,
            color = lerp(WebPalette.Info, WebPalette.Text, .15f), fontFeatureSettings = "'tnum'"))
    }
}

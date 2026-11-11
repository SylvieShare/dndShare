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
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import coil3.ImageLoader
import coil3.compose.AsyncImage
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun HeaderHealth(current: Int, maximum: Int, temporary: Int, images: ImageLoader, compact: Boolean = false) {
    val fraction = if (maximum > 0) current.toFloat() / maximum else 0f
    val color = when { fraction > .6f -> WebPalette.Success; fraction > .25f -> WebPalette.Warning; else -> WebPalette.Danger }
    val style = if (compact) ShareTypography.sheetHealthCompact else ShareTypography.sheetHealth
    val label = buildAnnotatedString {
        append(current.toString())
        withStyle(SpanStyle(fontFamily = ShareTypography.context.fontFamily, fontSize = ShareTypography.context.fontSize,
            fontWeight = ShareTypography.context.fontWeight, color = WebPalette.TextMuted)) { append("/$maximum") }
        if (temporary > 0) withStyle(SpanStyle(fontFamily = ShareTypography.context.fontFamily, fontSize = ShareTypography.context.fontSize,
            color = lerp(WebPalette.Info, WebPalette.Text, .15f))) { append(" +$temporary") }
    }
    Row(Modifier.clearAndSetSemantics {
        contentDescription = "Здоровье: $current из $maximum" + if (temporary > 0) ", временные $temporary" else ""
    }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        AsyncImage("file:///android_asset/character-sheet/hp-pulse.svg", null, images,
            colorFilter = ColorFilter.tint(color), modifier = Modifier.size(DesignTokens.Layout.SheetHealthIcon))
        Text(label, style = style.copy(color = WebPalette.Text, fontFeatureSettings = "'lnum', 'tnum'"), modifier = Modifier.weight(1f, fill = false))
    }
}

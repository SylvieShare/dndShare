package ru.dndshare.client.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun ItemCoverStat(stat: CoverValue) {
    val glyph =
        stat.glyph
            ?: when (stat.label) {
                "Урон",
                "Двумя руками",
                "Искусность" -> Glyph.Swords
                "Категория" -> Glyph.Badge
                "Дистанция" -> Glyph.Target
                "Стоимость" -> Glyph.Coins
                "Вес" -> Glyph.Weight
                "Время" -> Glyph.Clock
                "Длительность" -> Glyph.Hourglass
                "Компоненты" -> Glyph.Shapes
                "Редкость" -> Glyph.Gem
                "Зарядов" -> Glyph.Zap
                "Хиты" -> Glyph.Heart
                "КД",
                "Класс доспеха" -> Glyph.ShieldCheck
                else -> Glyph.Book
            }
    val tone =
        when (stat.label) {
            "Урон" -> WebPalette.Danger
            "Стоимость" -> WebPalette.Warning
            "Редкость" -> WebPalette.AccentSoft
            else -> WebPalette.Text
        }
    val background =
        when (stat.label) {
            "Урон" ->
                WebPalette.Danger.copy(alpha = .16f)
                    .compositeOver(WebPalette.Surface.copy(alpha = .75f))
            "Редкость" ->
                WebPalette.Accent.copy(alpha = .15f)
                    .compositeOver(WebPalette.Surface.copy(alpha = .75f))
            "Стоимость" ->
                WebPalette.Warning.copy(alpha = .13f)
                    .compositeOver(WebPalette.Surface.copy(alpha = .75f))
            else -> WebPalette.Surface.copy(alpha = .74f)
        }
    val large =
        stat.label in
            setOf("Урон", "Двумя руками", "Магический бонус", "Хиты", "КД", "Класс доспеха")
    Box(
        Modifier.fillMaxWidth()
            .background(background, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp)
    ) {
        AppGlyph(glyph, Modifier.align(Alignment.CenterEnd).size(27.dp), tone.copy(alpha = .46f))
        Column(Modifier.padding(end = 34.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(
                stat.label.uppercase(),
                maxLines = 1,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                style =
                    ShareTypography.context.copy(
                        fontSize = 9.sp,
                        lineHeight = 11.sp,
                        fontWeight = FontWeight.Bold,
                    ),
                color = tone,
            )
            Text(
                stat.value,
                style =
                    ShareTypography.group.copy(
                        fontSize = if (large) 27.sp else 17.sp,
                        lineHeight = if (large) 29.sp else 20.sp,
                        fontWeight = FontWeight.Bold,
                    ),
                color = WebPalette.Text,
            )
            if (stat.note.isNotBlank())
                Text(
                    stat.note,
                    fontSize = 10.sp,
                    lineHeight = 13.sp,
                    color = WebPalette.TextSecondary,
                )
            if (stat.dawn) AppGlyph(Glyph.Sunrise, Modifier.size(14.dp), WebPalette.TextMuted)
        }
    }
}

@Composable
internal fun ItemCoverRail(values: List<CoverValue>, phone: Boolean) {
    val background =
        Modifier.fillMaxWidth()
            .background(WebPalette.Surface.copy(alpha = .74f), RoundedCornerShape(10.dp))
            .padding(5.dp)
    if (phone) Column(background) { values.forEach { ItemRailValue(it, Modifier.fillMaxWidth()) } }
    else Row(background) { values.forEach { ItemRailValue(it, Modifier.weight(1f)) } }
}

@Composable
private fun ItemRailValue(stat: CoverValue, modifier: Modifier) {
    Row(
        modifier.heightIn(min = 42.dp).padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(
                stat.label.uppercase(),
                fontSize = 8.sp,
                lineHeight = 10.sp,
                color = WebPalette.TextMuted,
                fontWeight = FontWeight.Bold,
            )
            Text(
                stat.value,
                fontSize = 12.sp,
                lineHeight = 16.sp,
                color = WebPalette.Text,
                fontWeight = FontWeight.Bold,
            )
        }
        AppGlyph(
            stat.glyph ?: if (stat.label == "Свойства") Glyph.Tags else Glyph.Badge,
            Modifier.size(22.dp),
            WebPalette.AccentSoft.copy(alpha = .6f),
        )
    }
}

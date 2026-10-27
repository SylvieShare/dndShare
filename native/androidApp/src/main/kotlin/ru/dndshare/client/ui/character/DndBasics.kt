package ru.dndshare.client.ui.character

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.draw.clip
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.BuildConfig
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun DndStats(adaptive: Boolean = true) {
    val context = LocalCharacterSheet.current
    BoxWithConstraints(Modifier.fillMaxWidth()) {
    val columns = if (adaptive) ((maxWidth + 12.dp) / (DesignTokens.Layout.SheetStatMin + 12.dp)).toInt().coerceIn(1, 3) else 1
    val weights = dndAbilities.map { ability ->
        116 + (ability.skills.map(Long::toString) + context.sheet.values[ability.id].objectValue()["skills"].objectValue().keys).distinct().size * 34
    }
    ShareBalancedColumns(minimumWidth = if (adaptive) DesignTokens.Layout.SheetStatMin else 10_000.dp) {
        statColumnOrder(weights, columns).forEach { index -> key(dndAbilities[index].id) { DndAbilityTile(dndAbilities[index], adaptive) } }
    }
    }
}

@Composable
internal fun DndIdentityCard(compactHealth: Boolean = false) {
    val context = LocalCharacterSheet.current
    val sheet = context.sheet
    ShareTile(contentPadding = PaddingValues(0.dp), modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
            Column(Modifier.width(110.dp)) {
                if (sheet.iconImageUrl != null) AsyncImage(sheet.iconImageUrl, null, imageLoader = context.images,
                    contentScale = ContentScale.Crop, modifier = Modifier.size(110.dp))
                else Box(Modifier.size(110.dp).background(WebPalette.Raised), contentAlignment = Alignment.Center) {
                    Text(sheet.name.take(1), style = ShareTypography.title, color = WebPalette.AccentSoft)
                }
                Box(Modifier.fillMaxWidth().height(26.dp).clickable(enabled = context.canEdit) { context.edit("statuses") }, contentAlignment = Alignment.Center) {
                    Text("Статусы", style = ShareTypography.context, color = WebPalette.TextSecondary)
                }
            }
            Column(Modifier.weight(1f).padding(15.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(sheet.name, fontSize = 26.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold)
                    Text(sheet.values["race"].objectValue().label(), fontSize = 14.sp, color = WebPalette.TextSecondary)
                }
                Text(sheet.values["classes"].arrayValue().joinToString(" · ") { val row = it.objectValue(); "${row.label()} ${row["level"].number()}" }, fontSize = 14.sp, color = WebPalette.TextSecondary)
                DndHealth(compact = compactHealth)
            }
        }
        DndStatuses()
    }
}

@Composable
internal fun DndHealth(compact: Boolean = false) {
    val context = LocalCharacterSheet.current
    val sheet = context.sheet
    val hp = sheet.values["hp"].objectValue()
    val maximum = context.mechanics.hpMaximum()
    val current = hp["current"].number()
    val percent = if (maximum > 0) (current.toFloat() / maximum).coerceIn(0f, 1f) else 0f
    val color = if (percent > .6f) WebPalette.Success else if (percent > .25f) WebPalette.Warning else WebPalette.Danger
    val numbers: @Composable () -> Unit = {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            AsyncImage("file:///android_asset/character-sheet/hp-pulse.svg", null, imageLoader = context.images,
                colorFilter = ColorFilter.tint(color), modifier = Modifier.size(if (compact) 20.dp else 26.dp))
            Text(current.toString(), fontSize = if (compact) 22.sp else 36.sp, lineHeight = if (compact) 24.sp else 40.sp,
                fontWeight = FontWeight.ExtraBold, color = color)
            Text("/ $maximum", fontSize = if (compact) 16.sp else 22.sp, fontWeight = FontWeight.Bold, color = WebPalette.TextSecondary)
            if (hp["temp"].number() > 0) Text("+${hp["temp"].number()}", color = WebPalette.Info, fontSize = if (compact) 13.sp else 18.sp)
        }
    }
    val temp = if (maximum > 0) (hp["temp"].number().toFloat() / maximum).coerceIn(0f, 1f - percent) else 0f
    val click = Modifier.clickable(enabled = context.canEdit) { context.edit("hp") }
    if (compact) Column(Modifier.widthIn(min = 96.dp, max = 140.dp).then(click), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        numbers()
        HpBar(percent, temp, color, Modifier.fillMaxWidth(), 4.dp)
    } else Row(Modifier.fillMaxWidth().then(click), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(18.dp)) {
        numbers()
        HpBar(percent, temp, color, Modifier.weight(1f), 8.dp)
    }
}

@Composable
internal fun DndStatuses(showEmpty: Boolean = false) {
    val context = LocalCharacterSheet.current
    val values = context.sheet.values
    if (!showEmpty && values["states"].arrayValue().isEmpty() && values["exhaustion"].objectValue()["level"].number() == 0 && values["inspiration"] != JsonPrimitive(true)) return
    Row(Modifier.fillMaxWidth().clickable(enabled = context.canEdit) { context.edit("statuses") }
        .padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Состояния", style = ShareTypography.context, color = WebPalette.TextSecondary)
        val states = values["states"].arrayValue()
        if (states.isEmpty() && !showEmpty) Text("Нет состояний", style = ShareTypography.context, color = WebPalette.TextMuted)
        else Text(states.joinToString(" · ") { entry ->
            val data = entry.objectValue(); context.items[data["effect_id"].referenceId()]?.name ?: data.label().ifBlank { "Состояние" }
        }, style = ShareTypography.context, color = WebPalette.AccentSoft)
        if (values["inspiration"]?.jsonPrimitive?.booleanOrNull == true) Text("Вдохновение", style = ShareTypography.context, color = WebPalette.AccentSoft)
        if (values["exhaustion"].objectValue()["level"].number() > 0) Text("Истощение ${values["exhaustion"].objectValue()["level"].number()}", style = ShareTypography.context, color = WebPalette.Warning)
    }
}

@Composable
private fun HpBar(percent: Float, temporary: Float, color: Color, modifier: Modifier, height: androidx.compose.ui.unit.Dp) {
    BoxWithConstraints(modifier.height(height).clip(RoundedCornerShape(4.dp)).background(WebPalette.Raised)) {
        Box(Modifier.fillMaxHeight().fillMaxWidth(percent).background(color))
        if (temporary > 0f) Box(Modifier.offset(x = maxWidth * percent).fillMaxHeight().width(maxWidth * temporary).background(WebPalette.Info))
    }
}

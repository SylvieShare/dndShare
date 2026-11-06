package ru.dndshare.client.ui.character

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun DndHeading(ctx: SheetContext, format: LayoutFormat, open: (String) -> Unit) {
    val sheet = ctx.sheet
    val subtitle = listOf(sheet.subtitle(), sheet.values["lvl"].objectValue()["level"]?.let { "${it.number()} ур." }.orEmpty()).filter(String::isNotBlank).joinToString(" · ")
    val hp = sheet.values["hp"].objectValue()
    val current = hp["current"].number()
    val max = ctx.mechanics.hpMaximum()
    val temp = hp["temp"].number()
    val fraction = if (max > 0) (current.toFloat() / max).coerceIn(0f, 1f) else 0f
    val color = when { fraction > .6f -> WebPalette.Success; fraction > .25f -> WebPalette.Warning; else -> WebPalette.Danger }
    val image = sheet.iconImageUrl?.takeIf(String::isNotBlank) ?: sheet.portrait
    var failed by remember(image) { mutableStateOf(false) }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        val level = sheet.values["lvl"].objectValue()
        val xp = level["exp"].number()
        val progress = dndLevelProgress(level["level"].number(1), xp)
        Column(Modifier.width(DesignTokens.Layout.SheetHeaderIcon).clickable { open("profile") }
            .semantics { contentDescription = "Профиль персонажа" }, horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.fillMaxWidth().height(DesignTokens.Layout.SheetHeaderIcon - 5.dp)
                .clip(RoundedCornerShape(DesignTokens.Radius.Input)), contentAlignment = Alignment.Center) {
                if (image != null && !failed) AsyncImage(image, null, imageLoader = ctx.images, onError = { failed = true },
                    contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                else Text(sheet.name.take(1), style = ShareTypography.sheetHeader, color = WebPalette.AccentSoft)
            }
            Spacer(Modifier.height(2.dp))
            Box(Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(2.dp)).background(WebPalette.Raised)
                .semantics { contentDescription = progress.next?.let { "Прогресс уровня: $xp / $it опыта" } ?: "Максимальный уровень"
                    progressBarRangeInfo = ProgressBarRangeInfo(progress.percent, 0f..1f) }) {
                Spacer(Modifier.fillMaxWidth(progress.percent).fillMaxHeight().background(WebPalette.AccentSoft))
            }
        }
        Column(Modifier.weight(1f, fill = false)) {
            Row(Modifier.clickable { open("profile") }, verticalAlignment = Alignment.CenterVertically) {
                Text(sheet.name, Modifier.weight(1f, fill = false), style = ShareTypography.sheetHeader, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (format != LayoutFormat.Phone) Text("  " + subtitle, style = ShareTypography.context, color = WebPalette.TextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            if (format == LayoutFormat.Phone && subtitle.isNotBlank()) Text(subtitle, style = ShareTypography.context, color = WebPalette.TextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(Modifier.heightIn(min = 24.dp).clickable {
                if (!ctx.canEdit || current <= 0) open("health") else ctx.edit("hp")
            }.semantics { contentDescription = "Здоровье: $current из $max" },
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                SheetAssetIcon("hp-pulse.svg", ctx, Modifier.size(14.dp), color)
                Text("$current / $max", style = ShareTypography.context, maxLines = 1)
                if (temp > 0) Text("+$temp", style = ShareTypography.context, color = WebPalette.Info)
                if (current <= 0) Text("Спасброски", style = ShareTypography.context, color = color)
                else Box(Modifier.width(28.dp).height(3.dp).background(WebPalette.Raised)) {
                    Box(Modifier.fillMaxHeight().fillMaxWidth(fraction).background(color))
                }
            }
        }
        if (format == LayoutFormat.Wide) StatusChip(ctx, Modifier.widthIn(max = 170.dp)) { open("statuses") }
    }
}

@Composable
private fun SheetAssetIcon(asset: String, ctx: SheetContext, modifier: Modifier, tint: Color? = null) {
    AsyncImage(
        "file:///android_asset/character-sheet/$asset", null, ctx.images,
        modifier = modifier, colorFilter = tint?.let { ColorFilter.tint(it) },
        alpha = if (tint == null) .8f else 1f,
    )
}

@Composable
private fun StatusChip(ctx: SheetContext, modifier: Modifier, click: () -> Unit) {
    val values = ctx.sheet.values
    val states = values["states"].arrayValue().map {
        val row = it.objectValue()
        ctx.items[row["effect_id"].referenceId()]?.name ?: row.label().ifBlank { "Состояние" }
    }.toMutableList()
    values["exhaustion"].objectValue()["level"].number().takeIf { it > 0 }?.let { states.add("Истощение $it") }
    if ((values["inspiration"] as? JsonPrimitive)?.booleanOrNull == true) states.add("Вдохновение")
    Row(modifier.heightIn(min = 32.dp).clickable(onClick = click).semantics { contentDescription = "Состояния" },
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        AppGlyph(Glyph.Sparkles, Modifier.size(14.dp), WebPalette.AccentSoft)
        Text(states.firstOrNull() ?: "Состояния", Modifier.weight(1f, fill = false), maxLines = 1, overflow = TextOverflow.Ellipsis,
            style = ShareTypography.context, color = WebPalette.AccentSoft)
        if (states.size > 1) Text("+${states.size - 1}", style = ShareTypography.context)
    }
}

@Composable
internal fun DndSummaryStrip(format: LayoutFormat, open: (String) -> Unit) {
    val ctx = LocalCharacterSheet.current
    var initiativeMenu by remember { mutableStateOf(false) }
    val bonus = initiativeSummaryBonus(ctx)
    Row(Modifier.fillMaxWidth().padding(horizontal = DesignTokens.Spacing.Page),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (format == LayoutFormat.Tablet) 14.dp else 8.dp)) {
        @Composable fun metric(label: String, asset: String, value: String, click: () -> Unit) {
            Row(Modifier.sizeIn(minWidth = 40.dp, minHeight = 40.dp).clickable(enabled = ctx.canEdit, onClick = click).semantics { contentDescription = "$label $value" },
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                SheetAssetIcon(asset, ctx, Modifier.size(16.dp))
                if (format == LayoutFormat.Tablet) Text(label, style = ShareTypography.context, color = WebPalette.TextMuted)
                Text(value, style = ShareTypography.group)
            }
        }
        metric("КД", "shield.svg", ctx.mechanics.armor.total.toString()) { ctx.edit("utility:armor") }
        Box {
            metric("Инициатива", "initiative.svg", signed(bonus)) { initiativeMenu = true }
            SheetRollActions(initiativeMenu, { initiativeMenu = false }, SheetRollRequest("Инициатива", "initiative", bonus = bonus), "utility:initiative")
        }
        metric("Скорость", "speed.svg", "${ctx.mechanics.speed()} фт.") { ctx.edit("utility:speed") }
        StatusChip(ctx, Modifier.weight(1f)) { open("statuses") }
    }
}

@Composable
internal fun DndOverviewDialog(panel: String, close: () -> Unit, open: (String) -> Unit) {
    val ctx = LocalCharacterSheet.current
    val title = when (panel) { "profile" -> "Профиль персонажа"; "statuses" -> "Состояния"; "health" -> "Здоровье"; else -> "Сводка персонажа" }
    ShareFormDialog(title, close) {
        CompositionLocalProvider(LocalCharacterSheet provides ctx.copy(edit = { close(); ctx.edit(it) }, roll = { close(); ctx.roll(it) })) {
            when (panel) {
                "profile" -> { DndProfileDetails(); val level = ctx.sheet.values["lvl"].objectValue(); DndLevel(level["level"].number(1), level["exp"].number()) }
                "statuses" -> { DndStatuses(showEmpty = true); if (ctx.canEdit) ShareTextButton({ close(); ctx.edit("statuses") }) { Text("Изменить состояния") } }
                "health" -> { DndHealth(); if (ctx.canEdit) ShareTextButton({ close(); ctx.edit("hp") }) { Text("Изменить здоровье") } }
                else -> DndUtilities()
            }
            if (panel == "summary") ShareTextButton({ open("profile") }) { Text("Профиль персонажа") }
            if (panel == "profile") ShareTextButton({ open("summary") }) { Text("Сводка персонажа") }
            if (panel == "summary" || panel == "profile") ShareTextButton({ open("statuses") }) { Text("Состояния") }
        }
    }
}

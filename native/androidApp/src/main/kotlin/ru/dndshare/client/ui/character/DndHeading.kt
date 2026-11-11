package ru.dndshare.client.ui.character

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun DndHeading(ctx: SheetContext) {
    val sheet = ctx.sheet
    val level = sheet.values["lvl"].objectValue()
    val subtitle = listOf(sheet.subtitle(), level["level"].number(1).toString() + " ур.").filter(String::isNotBlank).joinToString(" · ")
    val hp = sheet.values["hp"].objectValue()
    val current = hp["current"].number()
    val maximum = ctx.mechanics.hpMaximum()
    val temporary = hp["temp"].number().coerceAtLeast(0)
    val image = sheet.iconImageUrl?.takeIf(String::isNotBlank) ?: sheet.portrait
    var failed by remember(image) { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    var healthDetails by remember { mutableStateOf(false) }
    fun edit(target: String) { menu = false; ctx.edit(target) }
    val xp = level["exp"].number()
    val progress = dndLevelProgress(level["level"].number(1), xp)
    Box(Modifier.widthIn(max = DesignTokens.Layout.SheetHeaderTileMax).fillMaxWidth()) {
        Column(
            Modifier.fillMaxWidth().clickable { menu = true }
                .semantics { contentDescription = "Действия персонажа" },
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.size(DesignTokens.Layout.SheetHeaderIcon)
                    .clip(RoundedCornerShape(DesignTokens.Radius.Input)), contentAlignment = Alignment.Center) {
                    if (image != null && !failed)
                        AsyncImage(image, null, imageLoader = ctx.images, onError = { failed = true },
                            contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                    else Text(sheet.name.take(1), style = ShareTypography.sheetHeader, color = WebPalette.AccentSoft)
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(sheet.name, style = ShareTypography.sheetHeader, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        HeaderMetric(Glyph.Shield, "Класс доспеха", ctx.mechanics.armor.total)
                        HeaderMetric(Glyph.Eye, "Пассивное внимание", passiveSkill(ctx, "WIS", 5, 10))
                        HeaderMetric(Glyph.Search, "Пассивное расследование", passiveSkill(ctx, "INT", 4, 5))
                    }
                }
            }
            HeaderHealth(current, maximum, temporary, ctx.images)
        }
        ShareDropdownMenu(menu, { menu = false }) {
            Text(subtitle, style = ShareTypography.context, color = WebPalette.TextMuted,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp), maxLines = 3, overflow = TextOverflow.Ellipsis)
            ShareDropdownMenuItem(
                text = { Text("Изменить персонажа") },
                leadingIcon = { AppGlyph(Glyph.Edit) },
                enabled = ctx.canEdit,
                onClick = { edit("identity") },
            )
            ShareDropdownMenuItem(
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Text("Опыт $xp" + (progress.next?.let { " / $it" } ?: ""))
                        LinearProgressIndicator(
                            { progress.percent }, Modifier.fillMaxWidth().height(7.dp).clip(RoundedCornerShape(4.dp)),
                            color = WebPalette.AccentSoft, trackColor = WebPalette.Raised,
                        )
                    }
                },
                leadingIcon = { AppGlyph(Glyph.Sparkles) },
                enabled = ctx.canEdit,
                onClick = { edit("level") },
            )
            ShareDropdownMenuItem(text = { Text(if (ctx.canEdit) "Изменить HP" else "Здоровье") },
                leadingIcon = { AppGlyph(Glyph.Heart) },
                onClick = {
                    if (ctx.canEdit) edit("hp")
                    else { menu = false; healthDetails = true }
                })
            ShareDropdownMenuItem(text = { Text("Добавить состояние") }, leadingIcon = { AppGlyph(Glyph.Plus) },
                enabled = ctx.canEdit, onClick = { edit("statuses") })
        }
    }
    if (healthDetails) ShareFormDialog("Здоровье", { healthDetails = false }) {
        SheetFormReadout("Текущие хиты", "$current / $maximum", Glyph.Heart)
        if (temporary > 0) SheetFormReadout("Временные хиты", temporary.toString())
        if (current <= 0) {
            SheetFormReadout("Успехи", hp["ds_success"].number().toString() + " / 3")
            SheetFormReadout("Провалы", hp["ds_failure"].number().toString() + " / 3")
        }
    }
}

@Composable
private fun HeaderMetric(icon: Glyph, label: String, value: Int) {
    Row(
        Modifier.semantics { contentDescription = "$label $value" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        AppGlyph(icon, Modifier.size(14.dp), WebPalette.TextMuted)
        Text(value.toString(), style = ShareTypography.context)
    }
}

private fun passiveSkill(ctx: SheetContext, stat: String, ability: Long, skill: Long): Int {
    val stored = ctx.sheet.values[stat].objectValue()["skills"].objectValue()[skill.toString()].objectValue()
    val rule = RuleContext(kind = "skill_check", ability = ability, skill = skill)
    val rank = maxOf(stored["up"].number(), ctx.mechanics.rank("skill_proficiency", rule))
    return 10 + abilityModifier(ctx.mechanics.score(stat)) + rank * ctx.sheet.proficiency() +
        stored["bonuses"].bonusTotal() + ctx.mechanics.bonus("skill_bonus", rule.copy(proficient = rank > 0))
}

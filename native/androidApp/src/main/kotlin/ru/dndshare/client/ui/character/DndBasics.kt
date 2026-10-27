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
import ru.dndshare.designsystem.*

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
private fun DndAbilityTile(ability: DndAbility, compact: Boolean) {
    val context = LocalCharacterSheet.current
    val sheet = context.sheet
    val data = sheet.values[ability.id].objectValue()
    val score = context.mechanics.score(ability.id)
    val modifier = abilityModifier(score)
    val saveContext = RuleContext(kind = "saving_throw", ability = ability.suggestId)
    val proficient = data["save_up"]?.jsonPrimitive?.booleanOrNull == true || context.mechanics.rank("save_proficiency", saveContext) > 0
    val save = modifier + (if (proficient) sheet.proficiency() else 0) + data["save_bonuses"].bonusTotal() + context.mechanics.bonus("save_bonus", saveContext)
    val skills = (ability.skills.map(Long::toString) + data["skills"].objectValue().keys).distinct()
    val titleSuggest = context.metadata.suggests["16"]?.firstOrNull { it.id == ability.suggestId }
    val color = titleSuggest?.color
        ?.let { runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull() } ?: WebPalette.TextMuted
    ShareTile(contentPadding = PaddingValues(0.dp), modifier = Modifier.fillMaxWidth(), accent = color) {
        Column(Modifier.fillMaxWidth().padding(start = 3.dp)) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(ability.title.uppercase(), Modifier.weight(1f).clickable(enabled = context.canEdit) { context.edit(ability.id) },
                    fontSize = 13.sp, lineHeight = 16.sp, fontWeight = FontWeight.Bold, color = WebPalette.TextMuted)
                Surface(color = WebPalette.Raised, border = BorderStroke(1.dp, if (proficient) color else WebPalette.Border), shape = RoundedCornerShape(8.dp)) {
                    Row(Modifier.padding(horizontal = if (compact) 9.dp else 6.dp, vertical = if (compact) 5.dp else 3.dp),
                        horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("спас", style = ShareTypography.row.copy(fontSize = if (compact) 13.sp else 11.sp, lineHeight = if (compact) 13.sp else 11.sp), color = WebPalette.TextMuted)
                        Text(signed(save), fontSize = if (compact) 15.sp else 13.sp, lineHeight = if (compact) 15.sp else 13.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
            Row(Modifier.fillMaxWidth().clickable(enabled = context.canEdit) { context.edit(ability.id) }
                .padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                titleSuggest?.svg?.takeIf(String::isNotBlank)?.let { svg ->
                    val model = remember(svg) { if (svg.contains("<svg")) svg.toByteArray() else if (svg.startsWith('/')) BuildConfig.API_BASE_URL + svg else svg }
                    AsyncImage(model, null, imageLoader = context.images, colorFilter = ColorFilter.tint(color), modifier = Modifier.size(if (compact) 32.dp else 26.dp))
                }
                Text(signed(modifier + context.mechanics.bonus("check_bonus", RuleContext(kind = "ability_check", ability = ability.suggestId))),
                    style = if (compact) ShareTypography.sheetStatCompact else ShareTypography.sheetStat, color = color)
                Text("($score)", color = WebPalette.TextMuted, fontSize = if (compact) 18.sp else 15.sp)
            }
            Column(Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, bottom = 12.dp)) {
                skills.forEach { id ->
                    val skill = data["skills"].objectValue()[id].objectValue()
                    val skillContext = RuleContext(kind = "skill_check", skill = id.toLongOrNull(), ability = ability.suggestId)
                    val rank = maxOf(skill["up"].number(), context.mechanics.rank("skill_proficiency", skillContext))
                    val title = skill.text("override_title").ifBlank {
                        context.metadata.suggests["15"]?.firstOrNull { it.id.toString() == id }?.value ?: skillNames[id.toIntOrNull()] ?: "Навык $id"
                    }
                    Row(Modifier.fillMaxWidth().heightIn(min = if (compact) 34.dp else 27.dp), verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(title, fontSize = if (compact) 15.sp else 13.sp, color = if (rank > 0) WebPalette.Text else WebPalette.TextSecondary)
                        HorizontalDivider(Modifier.weight(1f))
                        Surface(color = WebPalette.Raised, shape = RoundedCornerShape(if (compact) 9.dp else 7.dp),
                            border = BorderStroke(1.dp, if (rank > 0) color.copy(alpha = .5f) else WebPalette.Border)) {
                            Text(signed(modifier + rank * sheet.proficiency() + skill["bonuses"].bonusTotal() + context.mechanics.bonus("check_bonus", skillContext.copy(proficient = rank > 0))),
                                Modifier.padding(horizontal = if (compact) 10.dp else 7.dp, vertical = if (compact) 4.dp else 2.dp),
                                fontSize = if (compact) 16.sp else 13.sp, lineHeight = if (compact) 16.sp else 13.sp, fontWeight = FontWeight.Bold,
                                color = if (rank > 0) WebPalette.Text else WebPalette.TextSecondary)
                        }
                    }
                }
            }
        }
    }
}

private val skillNames = mapOf(1 to "Атлетика", 2 to "Акробатика", 3 to "Ловкость рук", 4 to "Скрытность", 5 to "Анализ",
    6 to "История", 7 to "Магия", 8 to "Природа", 9 to "Религия", 10 to "Внимательность", 11 to "Выживание", 12 to "Медицина",
    13 to "Проницательность", 14 to "Уход за животными", 15 to "Выступление", 16 to "Запугивание", 17 to "Обман", 18 to "Убеждение")

@Composable
internal fun DndIdentityCard() {
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
                DndHealth()
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
internal fun DndPhoneSummary() {
    Surface(color = WebPalette.Surface) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            DndHealth(compact = true)
            val active = LocalCharacterSheet.current.sheet.values
            if (active["states"].arrayValue().isNotEmpty() || active["inspiration"] == JsonPrimitive(true) || active["exhaustion"].objectValue()["level"].number() > 0) {
                Box(Modifier.weight(1f)) { DndStatuses(showEmpty = true) }
            }
        }
    }
}

@Composable
private fun HpBar(percent: Float, temporary: Float, color: Color, modifier: Modifier, height: androidx.compose.ui.unit.Dp) {
    BoxWithConstraints(modifier.height(height).clip(RoundedCornerShape(4.dp)).background(WebPalette.Raised)) {
        Box(Modifier.fillMaxHeight().fillMaxWidth(percent).background(color))
        if (temporary > 0f) Box(Modifier.offset(x = maxWidth * percent).fillMaxHeight().width(maxWidth * temporary).background(WebPalette.Info))
    }
}

package ru.dndshare.client.ui.character

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun DndUtilities() {
    val context = LocalCharacterSheet.current
    val sheet = context.sheet
    var initiativeMenu by remember { mutableStateOf(false) }
    val values = sheet.values
    val initiative = values["initiative"].objectValue()
    val bonus =
        initiative["base"].number() +
            initiative["bonuses"].bonusTotal() +
            (if (initiative["use_dex"]?.toString() == "true")
                abilityModifier(context.mechanics.score("DEX"))
            else 0) +
            context.mechanics.bonus("initiative_bonus", RuleContext(kind = "initiative"))
    val metrics =
        listOf(
            Triple("КД", context.mechanics.armor.total.toString(), "shield.svg"),
            Triple("ИНИЦИАТИВА", signed(bonus), "initiative.svg"),
            Triple("Меню", "", "menu"),
            Triple("СКОРОСТЬ", "${context.mechanics.speed()}фт", "speed.svg"),
            Triple("МАСТЕРСТВО", signed(sheet.proficiency()), "prof-bonus.svg"),
            Triple("Отдых", "", "rest"),
        )
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(15.dp)) {
        ShareTile(framed = false, contentPadding = PaddingValues(0.dp)) {
            Column {
                metrics.chunked(3).forEachIndexed { row, entries ->
                    if (row > 0) HorizontalDivider()
                    Row {
                        entries.forEachIndexed { index, (label, value, icon) ->
                            if (index > 0) VerticalDivider(Modifier.height(70.dp))
                            val action = icon.takeIf { it == "menu" || it == "rest" }
                            val editTarget =
                                action
                                    ?: "utility:" +
                                        when (icon) {
                                            "shield.svg" -> "armor"
                                            "initiative.svg" -> "initiative"
                                            "speed.svg" -> "speed"
                                            else -> "prof_bonus"
                                        }
                            Column(
                                Modifier.weight(1f)
                                    .height(70.dp)
                                    .clickable(enabled = action == "menu" || context.canEdit) {
                                        if (icon == "initiative.svg") initiativeMenu = true
                                        else context.edit(editTarget)
                                    }
                                    .padding(horizontal = 10.dp, vertical = 6.dp),
                                verticalArrangement = Arrangement.Center,
                            ) {
                                if (action == null)
                                    Text(
                                        label,
                                        fontSize = 10.sp,
                                        lineHeight = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = WebPalette.TextMuted,
                                    )
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    if (action != null)
                                        AppGlyph(
                                            if (action == "menu") Glyph.Settings else Glyph.Rest,
                                            Modifier.size(20.dp),
                                        )
                                    else
                                        AsyncImage(
                                            "file:///android_asset/character-sheet/$icon",
                                            null,
                                            imageLoader = context.images,
                                            colorFilter = ColorFilter.tint(WebPalette.TextMuted),
                                            modifier = Modifier.size(20.dp),
                                        )
                                    Text(
                                        if (action != null) label else value,
                                        fontSize = if (action != null) 13.sp else 22.sp,
                                        lineHeight = 24.sp,
                                        fontWeight =
                                            if (action != null) FontWeight.Bold
                                            else FontWeight.Normal,
                                    )
                                }
                                if (icon == "initiative.svg")
                                    SheetRollActions(
                                        initiativeMenu,
                                        { initiativeMenu = false },
                                        SheetRollRequest("Инициатива", "initiative", bonus = bonus),
                                        "utility:initiative",
                                    )
                            }
                        }
                    }
                }
            }
        }
        DndLevel(
            values["lvl"].objectValue()["level"].number(1),
            values["lvl"].objectValue()["exp"].number(),
        )
    }
}

@Composable
private fun DndLevel(level: Int, experience: Int) {
    val context = LocalCharacterSheet.current
    val thresholds =
        listOf(
            0,
            300,
            900,
            2700,
            6500,
            14000,
            23000,
            34000,
            48000,
            64000,
            85000,
            100000,
            120000,
            140000,
            165000,
            195000,
            225000,
            265000,
            305000,
            355000,
        )
    val previous = thresholds[(level - 1).coerceIn(thresholds.indices)]
    val next = thresholds.getOrNull(level)
    val percent =
        if (next != null && next > previous)
            ((experience - previous).toFloat() / (next - previous)).coerceIn(0f, 1f)
        else 1f
    ShareTile(
        Modifier.fillMaxWidth().heightIn(min = 64.dp),
        onClick = if (context.canEdit) ({ context.edit("level") }) else null,
        framed = false,
        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column {
                Text(
                    "УР.",
                    fontSize = 10.sp,
                    lineHeight = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = WebPalette.TextMuted,
                )
                Text(
                    level.toString(),
                    fontSize = 32.sp,
                    lineHeight = 34.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(
                    if (next != null) "$experience / $next" else experience.toString(),
                    fontSize = 13.sp,
                    lineHeight = 16.sp,
                    fontWeight = FontWeight.Bold,
                )
                LinearProgressIndicator(
                    { percent },
                    Modifier.fillMaxWidth().height(8.dp),
                    color = WebPalette.Accent,
                    trackColor = WebPalette.Raised,
                )
            }
        }
    }
}

package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetRollActions(
    open: Boolean,
    close: () -> Unit,
    request: SheetRollRequest,
    editTarget: String?,
    dieColor: Color = WebPalette.TextMuted,
) {
    val context = LocalCharacterSheet.current
    var mode by remember(open) {
        mutableStateOf(if (open) resolveSheetRollMode(context.mechanics, request).mode else "normal")
    }
    ShareDropdownMenu(open, close, Modifier.width(DesignTokens.Layout.RollModeMenuWidth)) {
        RollBonusSummary(request, dieColor)
        HorizontalDivider(color = WebPalette.BorderStrong)
        Text(
            "Режим броска",
            Modifier.padding(start = 8.dp, end = 8.dp, top = 12.dp, bottom = 8.dp),
            style = ShareTypography.context.copy(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
            color = WebPalette.TextMuted,
        )
        SheetRollModePicker(mode, { mode = it }, enabled = open)
        ShareDropdownMenuItem(
            text = { Text("Бросить кубик") },
            leadingIcon = { AppGlyph(Glyph.Dice, Modifier.size(18.dp)) },
            onClick = {
                close()
                context.roll(request.copy(manualMode = mode))
            },
        )
        if (context.canEdit && editTarget != null) {
            HorizontalDivider(Modifier.padding(horizontal = 7.dp, vertical = 4.dp), color = WebPalette.Border)
            ShareDropdownMenuItem(
                text = { Text("Изменить") },
                leadingIcon = { AppGlyph(Glyph.Edit, Modifier.size(18.dp)) },
                onClick = {
                    close()
                    context.edit(editTarget)
                },
            )
        }
    }
}

@Composable
private fun RollBonusSummary(request: SheetRollRequest, dieColor: Color) {
    val context = LocalCharacterSheet.current
    Row(
        Modifier.fillMaxWidth().padding(start = 10.dp, end = 10.dp, top = 8.dp, bottom = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(DesignTokens.Spacing.Label),
    ) {
        ShareDie(
            sides = 20,
            value = "d20",
            color = dieColor,
            modifier = Modifier.clearAndSetSemantics {},
        )
        Column(
            Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                Modifier.fillMaxWidth().clearAndSetSemantics {
                    heading()
                    contentDescription = "${request.title} · ${signed(request.bonus)}"
                },
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(request.title, Modifier.weight(1f), style = ShareTypography.header, color = WebPalette.Text)
                Text(signed(request.bonus), style = ShareTypography.header, color = WebPalette.Text)
            }
            val ability = dndAbilities.firstOrNull { it.suggestId == request.ability }
            if (ability != null) {
                val modifier = abilityModifier(context.mechanics.score(ability.id))
                val proficiency = request.proficiencyRank * context.sheet.proficiency()
                val extra = request.bonus - modifier - proficiency
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    BonusLine(ability.title, modifier)
                    if (proficiency != 0) {
                        BonusLine(if (request.proficiencyRank >= 2) "Мастерство" else "Владение", proficiency)
                    }
                    if (extra != 0) BonusLine("Дополнительные бонусы", extra)
                }
            }
        }
    }
}

@Composable
private fun BonusLine(label: String, value: Int) {
    val style = ShareTypography.context.copy(fontSize = 12.sp, lineHeight = 16.sp)
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(label, Modifier.weight(1f), style = style, color = WebPalette.TextSecondary)
        Text(signed(value), style = style, color = WebPalette.TextSecondary)
    }
}

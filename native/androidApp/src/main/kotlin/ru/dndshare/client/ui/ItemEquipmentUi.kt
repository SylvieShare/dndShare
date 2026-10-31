package ru.dndshare.client.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.*
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun EquipmentSection(
    title: String,
    icon: Glyph = Glyph.Book,
    tone: Color = WebPalette.AccentSoft,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                Modifier.size(28.dp).background(tone.copy(alpha = .15f), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center,
            ) {
                AppGlyph(icon, Modifier.size(16.dp), tone)
            }
            Text(
                title.uppercase(),
                Modifier,
                fontSize = 14.sp,
                lineHeight = 18.sp,
                fontWeight = FontWeight.ExtraBold,
                letterSpacing = 1.6.sp,
                color = WebPalette.Text,
            )
            HorizontalDivider(Modifier.weight(1f), color = tone.copy(alpha = .25f))
        }
        content()
    }
}

@Composable
internal fun EquipmentGrid(content: List<@Composable () -> Unit>) {
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val columns = if (maxWidth > 500.dp) 2 else 1
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            content.chunked(columns).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { block -> Box(Modifier.weight(1f)) { block() } }
                    repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
        }
    }
}

@Composable
internal fun EquipmentFact(
    label: String,
    value: String,
    note: String = "",
    icon: Glyph = Glyph.Wand,
    bonus: Boolean = false,
    content: (@Composable () -> Unit)? = null,
) {
    ShareTile(framed = false, contentPadding = PaddingValues(14.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(label, style = ShareTypography.context, color = WebPalette.TextMuted)
                if (value.isNotBlank())
                    Text(
                        value,
                        style =
                            if (bonus)
                                ShareTypography.section.copy(fontSize = 28.sp, lineHeight = 32.sp)
                            else ShareTypography.group,
                        color = if (bonus) WebPalette.AccentSoft else WebPalette.Text,
                    )
                content?.invoke()
                if (note.isNotBlank())
                    Text(note, style = ShareTypography.context, color = WebPalette.TextSecondary)
            }
            AppGlyph(icon, Modifier.size(32.dp), WebPalette.AccentSoft.copy(alpha = .25f))
        }
    }
}

@Composable
internal fun EquipmentTheses(lines: List<String>, tone: Color = WebPalette.AccentSoft) {
    lines.filter(String::isNotBlank).forEach { line ->
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("•", color = tone)
            Text(line, style = ShareTypography.context, color = WebPalette.TextSecondary)
        }
    }
}

@Composable
internal fun EquipmentDamage(rule: JsonObject, metadata: HandbookMetadata) {
    val dice = rule["dice"].objectValue()
    val formula = rule.text("dice").ifBlank { dice.text("value") }
    val sides =
        catalogueDieSides(rule["dice_id"], metadata)
            ?: catalogueDieSides(JsonPrimitive(formula), metadata)
    val count =
        rule["dice_count"]?.number()
            ?: rule["count"]?.number()
            ?: Regex("^(\\d+)").find(formula)?.value?.toIntOrNull()
            ?: 1
    val damage = metadata.suggest((rule["damage_type"] ?: rule["type"]).referenceId() ?: 0, 12)
    val color = runCatching {
        Color(android.graphics.Color.parseColor(damage?.color.orEmpty()))
    }.getOrDefault(WebPalette.Warning)
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            if (sides != null) {
                if (count > 1) Text(count.toString(), style = ShareTypography.group, color = color)
                ShareDie(sides, sides.toString(), color = color, size = 28.dp)
            } else
                Text(
                    formula.ifBlank { rule.text("flat").ifBlank { count.toString() } },
                    style = ShareTypography.group,
                    color = color,
                )
        }
        damage?.value?.takeIf(String::isNotBlank)?.let {
            Text(it, fontSize = 10.sp, lineHeight = 13.sp, color = color)
        }
    }
}

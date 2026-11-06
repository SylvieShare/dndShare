package ru.dndshare.client.ui.character

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import ru.dndshare.client.character.*
import ru.dndshare.client.model.CatalogueItem
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun WeaponMenuHeading(title: String, item: CatalogueItem?, ability: String, scope: String, bonus: Int) {
    val context = LocalCharacterSheet.current
    val model = item?.iconImageUrl ?: item?.svg?.let { remember(it) { it.toByteArray() } }
        ?: context.metadata.types.firstOrNull { it.id == item?.typeId }?.iconImageUrl
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        if (model != null) AsyncImage(model, null, imageLoader = context.images, modifier = Modifier.size(40.dp))
        else AppGlyph(Glyph.Swords, Modifier.size(40.dp), WebPalette.TextMuted)
        Column(Modifier.weight(1f)) {
            Text("$title · ${if (scope == "attack") "Атака" else "Урон"}", style = ShareTypography.header)
            Text(ability, style = ShareTypography.context, color = WebPalette.TextMuted)
        }
        if (scope == "attack") Text(signed(bonus), style = ShareTypography.header)
    }
    HorizontalDivider(color = WebPalette.BorderStrong)
}

@Composable
internal fun WeaponAttackPreview(
    request: SheetRollRequest, modifiers: List<FormulaSource>, enabled: Boolean,
    excluded: List<String>, setExcluded: (List<String>) -> Unit,
) {
    val context = LocalCharacterSheet.current
    val bonusRules = context.mechanics.rules("roll_bonus", request.ruleContext()).filter { it.rule.text("formula").isNotBlank() }
    bonusRules.forEach { source ->
        val key = source.rule.text("key")
        WeaponOptionSwitch(
            "${source.sourceLabel}: ${source.rule.text("formula")}",
            key !in excluded,
            enabled,
        ) { checked ->
            setExcluded(if (checked) excluded - key else excluded + key)
        }
    }
    val resolved = resolveSheetRollMode(context.mechanics, request).mode
    val rows = buildList {
        val label = when (resolved) { "advantage" -> "Преимущество"; "disadvantage" -> "Помеха"; else -> "Атака" }
        add(FormulaSource(label, if (resolved in listOf("advantage", "disadvantage")) "2d20" else "1d20"))
        addAll(modifiers)
        if (context.sheet.sourceVersion == "2024") {
            val exhaustion = context.sheet.values["exhaustion"].objectValue()["level"].number()
            if (exhaustion > 0) add(FormulaSource("Истощение", (-2 * exhaustion).toString()))
        }
        bonusRules.filter { it.rule.text("key") !in excluded }.forEach {
            add(FormulaSource(it.sourceLabel.ifBlank { "Бонус" }, it.rule.text("formula")))
        }
    }
    WeaponFormulaPreview(rows)
}

@Composable
internal fun WeaponFormulaPreview(rows: List<FormulaSource>) {
    Column(Modifier.fillMaxWidth().background(WebPalette.Surface, RoundedCornerShape(10.dp)).padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)) {
        for ((source, parts) in rows.groupBy { it.source }) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(source, Modifier.weight(1f), style = ShareTypography.context, color = WebPalette.TextSecondary)
                FlowRow(Modifier.widthIn(max = 166.dp), horizontalArrangement = Arrangement.spacedBy(3.dp),
                    itemVerticalAlignment = Alignment.CenterVertically) {
                    var first = true
                    for (part in parts) {
                        val tokens = remember(part.expression) { runCatching { diceFormulaTokens(part.expression) }.getOrNull() }
                        if (tokens == null) Text(part.expression, style = ShareTypography.group)
                        else for (token in tokens) {
                            val (_, operator, body, type, tint) = token.groupValues
                            val sides = body.substringAfter('d', "").toIntOrNull()
                            if (sides == null) Text("${if (operator == "*") "×" else operator}$body", style = ShareTypography.group)
                            else {
                                if (!first || operator != "+") Text(if (operator == "*") "×" else operator)
                                val count = body.substringBefore('d').toIntOrNull() ?: 1
                                if (count > 1) Text("${count}×", style = ShareTypography.context)
                                val color = remember(tint) {
                                    runCatching { Color(android.graphics.Color.parseColor(tint)) }.getOrDefault(WebPalette.AccentSoft)
                                }
                                ShareDie(sides, "d$sides", color, Modifier.semantics { contentDescription = "$body $type".trim() }, size = 30.dp)
                            }
                            first = false
                        }
                    }
                }
            }
        }
    }
}

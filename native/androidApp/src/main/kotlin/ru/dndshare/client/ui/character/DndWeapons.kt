package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun DndWeapons(format: LayoutFormat) {
    val context = LocalCharacterSheet.current
    val direct = context.sheet.values["weapon"].arrayValue().map { it.objectValue() }
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SheetSummaryHeading(
                "Оружие",
                if (context.canEdit && direct.size > 1)
                    listOf(
                        ShareMenuAction(
                            "Изменить порядок",
                            Glyph.Move,
                            { context.edit("reorder:weapons") },
                        )
                    )
                else emptyList(),
                divider = true,
            )
            if (direct.isEmpty()) SheetEmpty("Нет оружия")
            WeaponGrid(
                direct,
                if (format == LayoutFormat.Tablet) 2 else 1,
                context.canEdit && format != LayoutFormat.Wide,
                context.reorderWeapons,
            ) { entry, modifier, dragging ->
                val weapon =
                    remember(context.sheet, context.items, entry) {
                        weaponReadout(context.sheet, entry, context.items, context.metadata)
                    }
                WeaponSheetCard(entry, weapon, format, modifier, dragging)
            }
            if (context.canEdit)
                ShareDashedAction(
                    "+ Добавить оружие",
                    { context.edit("weapon:new") },
                    compact = true,
                )
        }
        ShareTile(Modifier.fillMaxWidth(), framed = false, contentPadding = PaddingValues(18.dp)) {
            SheetSummaryHeading("Базовые атаки", divider = true)
            PresetAttack("Рукопашный удар", true)
            PresetAttack("Импровизированное оружие", false)
        }
    }
}

@Composable
private fun PresetAttack(title: String, unarmed: Boolean) {
    val context = LocalCharacterSheet.current
    val strength = abilityModifier(context.mechanics.score("STR"))
    val bonus = strength + (if (unarmed) context.sheet.proficiency() else 0)
    val damageFeatures = context.mechanics.rules("weapon_damage_bonus", RuleContext(kind = "attack", ability = 1, weaponKind = "melee"))
        .map { FormulaSource(it.sourceLabel, context.mechanics.numericValue(it.rule).toString()) }
        .filter { it.expression != "0" }
    val extra = damageFeatures.sumOf { it.expression.toInt() }
    val art = context.items[if (unarmed) 64L else 35L]
    var attack by remember(title) { mutableStateOf(false) }
    var damage by remember(title) { mutableStateOf(false) }
    val label: @Composable () -> Unit = {
        Text(
            title,
            style =
                ShareTypography.group.copy(
                    fontSize = 15.sp,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                ),
        )
        Text(
            if (unarmed) "Сила · урон 1 + модификатор" else "Сила · без владения",
            style = ShareTypography.context,
            color = WebPalette.TextMuted,
        )
        if (unarmed) Text("Владение", style = ShareTypography.context, color = WebPalette.Success)
    }
    val buttons: @Composable () -> Unit = {
        Box {
            WeaponAttackValue(title, bonus, context.canEdit) { attack = true }
            ShareDropdownMenu(attack, { attack = false }, Modifier.width(DesignTokens.Layout.RollModeMenuWidth)) {
                var mode by remember { mutableStateOf("auto") }
                var excluded by remember { mutableStateOf(emptyList<String>()) }
                val request = SheetRollRequest("Атака: $title", "attack", 1, bonus = bonus, weaponKind = "melee",
                    weaponAttack = !unarmed, improvised = !unarmed, proficiencyRank = if (unarmed) 1 else 0,
                    sourceName = title, manualMode = mode, excludedBonuses = excluded)
                Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    WeaponMenuHeading(title, art, "Сила", "attack", bonus)
                    SheetRollModePicker(mode, { mode = it }, neutralMode = "auto", enabled = true)
                    val modifiers = buildList {
                        if (strength != 0) add(FormulaSource("Сила", strength.toString()))
                        if (unarmed) add(FormulaSource("Владение", context.sheet.proficiency().toString()))
                    }
                    WeaponAttackPreview(request, modifiers, true, excluded) { excluded = it }
                    ShareDropdownMenuItem(text = { Text("Бросить на атаку") }, onClick = {
                        attack = false
                        context.roll(request)
                    })
                }
            }
        }
        Box {
            WeaponDamageFace(
                title,
                listOf(
                    WeaponDamagePart(
                        if (unarmed) (1 + strength + extra).coerceAtLeast(0) else 1,
                        if (unarmed) null else 4,
                        "Дробящий",
                    )
                ),
                emptyList(),
                if (unarmed) 0 else strength + extra,
                context.canEdit,
            ) {
                damage = true
            }
            ShareDropdownMenu(damage, { damage = false }, Modifier.width(DesignTokens.Layout.RollModeMenuWidth)) {
                var critical by remember { mutableStateOf(false) }
                val amount = strength + extra
                val die = if (critical) "2d4" else "1d4"
                val formula = if (unarmed) (1 + amount).coerceAtLeast(0).toString() else die + signed(amount)
                Column(Modifier.padding(8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    WeaponMenuHeading(title, art, "Сила", "damage", bonus)
                    WeaponOptionSwitch("Критическое попадание", critical, true) { critical = it }
                    val rows = buildList {
                        add(if (unarmed) FormulaSource(title, "1") else FormulaSource("Оружие", die))
                        if (strength != 0) add(FormulaSource("Сила", strength.toString()))
                        addAll(damageFeatures)
                        if (unarmed && 1 + amount < 0) add(FormulaSource("Минимум урона", (-1 - amount).toString()))
                    }
                    WeaponFormulaPreview(rows)
                    ShareDropdownMenuItem(text = { Text("Бросить на урон") }, onClick = {
                        damage = false
                        val action = if (critical) "Критический урон" else "Урон"
                        context.roll(SheetRollRequest("$action: $title", "damage", formula = formula,
                            damageTerms = listOf(SheetDamageTerm(formula, "Дробящий")), minimumTotal = 0))
                    })
                }
            }
        }
    }
    BoxWithConstraints(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp)) {
        if (maxWidth >= 500.dp)
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) { label() }
                buttons()
            }
        else
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                label()
                Row(
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                ) {
                    buttons()
                }
            }
    }
    HorizontalDivider(color = WebPalette.Border)
}

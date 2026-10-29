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
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun DndWeapons() {
    val context = LocalCharacterSheet.current
    val direct = context.sheet.values["weapon"].arrayValue().map { it.objectValue() }
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        ShareTile(Modifier.fillMaxWidth(), framed = false, contentPadding = PaddingValues(18.dp)) {
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
            direct.forEach { entry ->
                key(entry.text("uid")) {
                    val weapon =
                        remember(context.sheet, context.items, entry) {
                            weaponReadout(context.sheet, entry, context.items, context.metadata)
                        }
                    WeaponSheetCard(entry, weapon)
                }
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
    val extra =
        context.mechanics.bonus(
            "weapon_damage_bonus",
            RuleContext(kind = "attack", ability = 1, weaponKind = "melee"),
        )
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
            SheetRollActions(
                attack,
                { attack = false },
                SheetRollRequest(
                    "Атака: $title",
                    "attack",
                    1,
                    bonus = bonus,
                    weaponKind = "melee",
                    weaponAttack = !unarmed,
                    improvised = !unarmed,
                    proficiencyRank = if (unarmed) 1 else 0,
                    sourceName = title,
                ),
                null,
            )
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
            ShareDropdownMenu(damage, { damage = false }) {
                listOf(false to "Урон", true to "Критический урон").forEach { (critical, text) ->
                    ShareDropdownMenuItem(
                        text = { Text(text) },
                        leadingIcon = { AppGlyph(Glyph.Dice, Modifier.size(18.dp)) },
                        onClick = {
                            damage = false
                            val amount = strength + extra
                            val formula =
                                if (unarmed) (1 + amount).coerceAtLeast(0).toString()
                                else
                                    "${if(critical)2 else 1}d4" +
                                        (if (amount >= 0) "+$amount" else amount.toString())
                            context.roll(
                                SheetRollRequest(
                                    "$text: $title",
                                    "damage",
                                    formula = formula,
                                    damageTerms = listOf(SheetDamageTerm(formula, "Дробящий")),
                                    minimumTotal = 0,
                                )
                            )
                        },
                    )
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

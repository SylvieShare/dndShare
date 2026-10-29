package ru.dndshare.client.ui.character

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun WeaponAttackValue(title: String, bonus: Int, enabled: Boolean, roll: (() -> Unit)?) {
    Surface(
        Modifier.then(
                if (roll != null)
                    Modifier.clickable(enabled = enabled, role = Role.Button, onClick = roll)
                else Modifier
            )
            .semantics {
                contentDescription = "Атака: $title"
                stateDescription = signed(bonus)
            },
        color = WebPalette.AccentSoft.copy(alpha = .08f).compositeOver(WebPalette.Surface),
        shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, WebPalette.AccentSoft.copy(alpha = .32f)),
    ) {
        Row(
            Modifier.padding(horizontal = 11.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Text(
                "АТАКА",
                style =
                    ShareTypography.context.copy(
                        fontSize = 10.sp,
                        lineHeight = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = .4.sp,
                    ),
                color = WebPalette.AccentSoft,
            )
            Text(
                signed(bonus),
                style =
                    ShareTypography.group.copy(
                        fontSize = 15.sp,
                        lineHeight = 15.sp,
                        fontWeight = FontWeight.Bold,
                    ),
                color = WebPalette.Text,
            )
        }
    }
}

@Composable
internal fun WeaponDamageFace(
    title: String,
    parts: List<WeaponDamagePart>,
    twoHanded: List<WeaponDamagePart>,
    bonus: Int,
    enabled: Boolean,
    roll: (() -> Unit)?,
) {
    val groups = remember(parts, twoHanded, bonus) { weaponDamageGroups(parts, twoHanded, bonus) }
    FlowRow(
        Modifier.then(
                if (roll != null)
                    Modifier.clickable(enabled = enabled, role = Role.Button, onClick = roll)
                else Modifier
            )
            .semantics { contentDescription = "Урон: $title" },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        groups.forEachIndexed { index, group ->
            if (index > 0) Text("+", Modifier.height(42.dp), color = WebPalette.TextMuted)
            val color =
                remember(group.color) {
                    runCatching { Color(android.graphics.Color.parseColor(group.color)) }
                        .getOrDefault(WebPalette.Warning)
                }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                FlowRow(
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    if (group.terms.isEmpty()) DamageNumber(signed(group.modifier), color)
                    group.terms.forEachIndexed { termIndex, term ->
                        if (termIndex > 0) DamageOperator("+")
                        term.forEachIndexed { variantIndex, variant ->
                            if (variantIndex > 0) DamageOperator("/")
                            if (variant.isEmpty()) DamageNumber("0", color)
                            if (term.size > 1 && variant.size > 1) DamageOperator("(")
                            variant.forEachIndexed { partIndex, part ->
                                if (partIndex > 0) DamageOperator("+")
                                if (part.sides != null) {
                                    if (part.count != 1) DamageNumber(part.count.toString(), color)
                                    ShareDie(part.sides, part.sides.toString(), color, size = 42.dp)
                                } else DamageNumber(part.count.toString(), color)
                            }
                            if (term.size > 1 && variant.size > 1) DamageOperator(")")
                        }
                    }
                    if (group.modifier != 0 && group.terms.isNotEmpty()) {
                        DamageOperator(if (group.modifier > 0) "+" else "−")
                        DamageNumber(kotlin.math.abs(group.modifier).toString(), color)
                    }
                }
                if (group.type.isNotBlank())
                    Text(
                        group.type,
                        Modifier.widthIn(max = 94.5.dp),
                        style =
                            ShareTypography.context.copy(
                                fontSize = 11.sp,
                                lineHeight = 13.2.sp,
                                fontWeight = FontWeight.SemiBold,
                            ),
                        color = color.copy(alpha = .9f),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    )
            }
        }
    }
}

@Composable
private fun DamageNumber(value: String, color: Color) {
    Box(Modifier.heightIn(min = 42.dp), contentAlignment = Alignment.Center) {
        Text(
            value,
            style = ShareTypography.group.copy(fontSize = 16.sp, fontWeight = FontWeight.ExtraBold),
            color = color,
        )
    }
}

@Composable
private fun DamageOperator(value: String) {
    Box(Modifier.height(42.dp), contentAlignment = Alignment.Center) {
        Text(value, color = WebPalette.TextMuted, fontSize = 14.sp, fontWeight = FontWeight.Bold)
    }
}

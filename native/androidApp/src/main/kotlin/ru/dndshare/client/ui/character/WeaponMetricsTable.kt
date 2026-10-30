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
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.*
import kotlin.math.roundToInt
import ru.dndshare.client.character.WeaponReadout
import ru.dndshare.client.character.signed
import ru.dndshare.client.ui.RichDescription
import ru.dndshare.client.ui.designsystem.*

/** Decide per weapon from intrinsic content widths, keeping complete damage formulas legible. */
@Composable
internal fun WeaponMetricsTable(
    title: String,
    weapon: WeaponReadout,
    modifier: Modifier = Modifier,
    propertyDescriptions: Map<String, String> = emptyMap(),
    openItem: (Long) -> Unit = {},
) {
    val scale = LocalDensity.current.fontScale.coerceAtLeast(1f)
    val properties = weapon.properties.filter(String::isNotBlank)
    Layout(
        modifier = modifier.fillMaxWidth(),
        content = {
            Box(
                Modifier.background(WebPalette.Raised, RoundedCornerShape(DesignTokens.Radius.Row))
                    .heightIn(min = DesignTokens.Layout.WeaponMetricsAttackMinHeight * scale)
                    .testTag("weapon-attack-cell"),
                contentAlignment = Alignment.Center,
            ) {
                CellLabel("Атака", Modifier.align(Alignment.TopStart).padding(8.dp))
                Text(
                    signed(weapon.attack),
                    Modifier.semantics {
                        contentDescription = "Атака: $title"
                        stateDescription = signed(weapon.attack)
                    },
                    color = WebPalette.AccentSoft,
                    style = ShareTypography.weaponAttack,
                )
            }
            MetricCell("Урон", Modifier) {
                WeaponDamageFace(
                    title,
                    weapon.parts,
                    weapon.twoHanded,
                    weapon.damageBonus,
                    false,
                    null,
                )
            }
            if (properties.isNotEmpty())
                MetricCell("Свойства", Modifier) {
                    PropertyText(properties, propertyDescriptions, openItem)
                }
        },
    ) { cells, constraints ->
        val width = constraints.maxWidth
        val gap = DesignTokens.Layout.WeaponMetricsGap.roundToPx()
        val attackWidth =
            (DesignTokens.Layout.WeaponMetricsAttackWidth * scale)
                .roundToPx()
                .coerceAtMost(((width - gap) / 2).coerceAtLeast(1))
        val available = (width - attackWidth - gap).coerceAtLeast(1)
        val naturalDamage = cells[1].maxIntrinsicWidth(Constraints.Infinity).coerceIn(1, available)
        val propertyWidth =
            if (properties.isNotEmpty()) cells[2].minIntrinsicWidth(Constraints.Infinity) else 0
        val inline =
            properties.isNotEmpty() &&
                attackWidth + naturalDamage + propertyWidth + gap * 2 <= width
        val extra = (width - attackWidth - naturalDamage - propertyWidth - gap * 2).coerceAtLeast(0)
        val damageWidth =
            if (inline) naturalDamage + (extra * 1.25f / 2.25f).roundToInt() else available
        val actualPropertyWidth = if (inline) width - attackWidth - damageWidth - gap * 2 else width
        val topHeight =
            maxOf(
                cells[0].minIntrinsicHeight(attackWidth),
                cells[1].minIntrinsicHeight(damageWidth),
                if (inline) cells[2].minIntrinsicHeight(actualPropertyWidth) else 0,
            )
        val attack = cells[0].measure(Constraints.fixed(attackWidth, topHeight))
        val damage = cells[1].measure(Constraints.fixed(damageWidth, topHeight))
        val property =
            if (properties.isEmpty()) null
            else
                cells[2].measure(
                    if (inline) Constraints.fixed(actualPropertyWidth, topHeight)
                    else Constraints.fixedWidth(actualPropertyWidth)
                )
        val total = topHeight + if (property != null && !inline) gap + property.height else 0
        layout(width, constraints.constrainHeight(total)) {
            attack.placeRelative(0, 0)
            damage.placeRelative(attackWidth + gap, 0)
            property?.placeRelative(
                if (inline) attackWidth + damageWidth + gap * 2 else 0,
                if (inline) 0 else topHeight + gap,
            )
        }
    }
}

@Composable
private fun MetricCell(label: String, modifier: Modifier, content: @Composable () -> Unit) {
    Column(
        modifier
            .background(WebPalette.Raised, RoundedCornerShape(DesignTokens.Radius.Row))
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        CellLabel(label)
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterStart) { content() }
    }
}

@Composable
private fun CellLabel(label: String, modifier: Modifier = Modifier) {
    Text(
        label,
        modifier,
        style = ShareTypography.context.copy(fontSize = 10.sp, lineHeight = 12.sp),
        color = WebPalette.TextMuted,
    )
}

@Composable
private fun PropertyText(
    properties: List<String>,
    descriptions: Map<String, String>,
    openItem: (Long) -> Unit,
) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        properties.forEach { property ->
            var open by remember(property) { mutableStateOf(false) }
            Box {
                Text(
                    property,
                    Modifier.clip(RoundedCornerShape(4.dp))
                        .clickable(role = Role.Button, onClickLabel = "Описание свойства") {
                            open = true
                        }
                        .padding(vertical = 3.dp),
                    style = ShareTypography.weaponProperty,
                    textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline,
                    color = WebPalette.TextSecondary,
                )
                ShareDropdownMenu(open, { open = false }, Modifier.width(296.dp)) {
                    Column(
                        Modifier.padding(10.dp).semantics { paneTitle = "Свойство: $property" },
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Text(property, style = ShareTypography.header)
                        RichDescription(
                            descriptions[property]?.takeIf(String::isNotBlank)
                                ?: "Описание свойства пока недоступно.",
                            openItem = openItem,
                        )
                        ShareTextButton({ open = false }) { Text("Понятно") }
                    }
                }
            }
        }
    }
}

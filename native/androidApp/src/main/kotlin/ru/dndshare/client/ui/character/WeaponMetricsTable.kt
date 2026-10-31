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
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.*
import ru.dndshare.client.character.WeaponReadout
import ru.dndshare.client.character.signed
import ru.dndshare.client.ui.RichDescription
import ru.dndshare.client.ui.designsystem.*

/** A square attack cell, flexible damage, and a separate full-width properties row. */
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
    val attackSize = DesignTokens.Layout.WeaponMetricsAttackWidth * scale
    Column(
        modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(DesignTokens.Layout.WeaponMetricsGap),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(DesignTokens.Layout.WeaponMetricsGap)) {
            Box(
                Modifier.size(attackSize)
                    .background(WebPalette.Raised, RoundedCornerShape(DesignTokens.Radius.Row))
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
            MetricCell("Урон", Modifier.weight(1f).heightIn(min = attackSize)) {
                WeaponDamageFace(
                    title,
                    weapon.parts,
                    weapon.twoHanded,
                    weapon.damageBonus,
                    false,
                    null,
                )
            }
        }
        if (properties.isNotEmpty())
            MetricCell("Свойства", Modifier.fillMaxWidth()) {
                PropertyText(properties, propertyDescriptions, openItem)
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

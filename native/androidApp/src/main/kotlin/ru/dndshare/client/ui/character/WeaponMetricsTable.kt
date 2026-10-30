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
import androidx.compose.ui.semantics.*
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dndshare.client.character.WeaponReadout
import ru.dndshare.client.character.signed
import ru.dndshare.client.ui.RichDescription
import ru.dndshare.client.ui.designsystem.*

/** One frame, shared cell labels; properties take a full row when three columns cannot fit. */
@Composable
internal fun WeaponMetricsTable(
    title: String,
    weapon: WeaponReadout,
    modifier: Modifier = Modifier,
    propertyDescriptions: Map<String, String> = emptyMap(),
    openItem: (Long) -> Unit = {},
) {
    val gap = DesignTokens.Layout.WeaponMetricsGap
    val scale = LocalDensity.current.fontScale.coerceAtLeast(1f)
    BoxWithConstraints(modifier.fillMaxWidth()) {
        val stacked = maxWidth < DesignTokens.Layout.WeaponMetricsWideMin * scale
        Column {
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
                MetricCell(
                    "Атака",
                    Modifier.width(DesignTokens.Layout.WeaponMetricsAttackWidth * scale)
                        .fillMaxHeight(),
                ) {
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
                Spacer(Modifier.width(gap))
                MetricCell("Урон", Modifier.weight(if (stacked) 1f else 1.25f).fillMaxHeight()) {
                    WeaponDamageFace(
                        title,
                        weapon.parts,
                        weapon.twoHanded,
                        weapon.damageBonus,
                        false,
                        null,
                    )
                }
                if (!stacked) {
                    Spacer(Modifier.width(gap))
                    MetricCell("Свойства", Modifier.weight(1f).fillMaxHeight()) {
                        PropertyText(weapon.properties, propertyDescriptions, openItem)
                    }
                }
            }
            if (stacked) {
                Spacer(Modifier.height(gap))
                MetricCell("Свойства", Modifier.fillMaxWidth()) {
                    PropertyText(weapon.properties, propertyDescriptions, openItem)
                }
            }
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
        Text(
            label,
            style = ShareTypography.context.copy(fontSize = 10.sp, lineHeight = 12.sp),
            color = WebPalette.TextMuted,
        )
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterStart) { content() }
    }
}

@Composable
private fun PropertyText(
    properties: List<String>,
    descriptions: Map<String, String>,
    openItem: (Long) -> Unit,
) {
    if (properties.isEmpty())
        Text("—", style = ShareTypography.weaponProperty, color = WebPalette.TextSecondary)
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

package ru.dndshare.client.ui.character

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dndshare.client.character.WeaponReadout
import ru.dndshare.client.character.signed
import ru.dndshare.client.ui.designsystem.*

/** One frame, shared cell labels; properties take a full row when three columns cannot fit. */
@Composable
internal fun WeaponMetricsTable(
    title: String,
    weapon: WeaponReadout,
    modifier: Modifier = Modifier,
) {
    val stroke = DesignTokens.Layout.WeaponMetricsStroke
    val shape = RoundedCornerShape(DesignTokens.Radius.Row)
    val scale = LocalDensity.current.fontScale.coerceAtLeast(1f)
    BoxWithConstraints(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .border(stroke, WebPalette.Background, shape)
            .padding(stroke)
    ) {
        val stacked = maxWidth + stroke * 2 < DesignTokens.Layout.WeaponMetricsWideMin * scale
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
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Box(Modifier.width(stroke).fillMaxHeight().background(WebPalette.Background))
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
                    Box(Modifier.width(stroke).fillMaxHeight().background(WebPalette.Background))
                    MetricCell("Свойства", Modifier.weight(1f).fillMaxHeight()) {
                        PropertyText(weapon.properties)
                    }
                }
            }
            if (stacked) {
                Box(Modifier.fillMaxWidth().height(stroke).background(WebPalette.Background))
                MetricCell("Свойства", Modifier.fillMaxWidth()) { PropertyText(weapon.properties) }
            }
        }
    }
}

@Composable
private fun MetricCell(label: String, modifier: Modifier, content: @Composable () -> Unit) {
    Column(
        modifier.background(WebPalette.Surface).padding(8.dp),
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
private fun PropertyText(properties: List<String>) {
    Text(
        properties.joinToString(" · ").ifBlank { "—" },
        style = ShareTypography.context.copy(fontSize = 11.sp, lineHeight = 15.sp),
        color = WebPalette.TextSecondary,
    )
}

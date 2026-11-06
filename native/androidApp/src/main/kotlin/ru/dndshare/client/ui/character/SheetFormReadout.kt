package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SheetFormReadout(label: String, value: String, icon: Glyph? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        if (icon != null) AppGlyph(icon, Modifier.size(18.dp), WebPalette.TextSecondary)
        Text(label, Modifier.weight(1f), style = ShareTypography.context, color = WebPalette.TextSecondary)
        Text(value, style = ShareTypography.group)
    }
}

@Composable
internal fun ArmorSummary(form: FeatureFormScope) {
    val armor = LocalCharacterSheet.current.mechanics.armor
    val manual = armorManualBonus(form.data["bonuses"])
    val subtotal = armor.baseValue + armor.shieldValue + armor.features.sumOf { it.second } + manual
    ShareTile(Modifier.fillMaxWidth(), framed = false, contentPadding = PaddingValues(12.dp)) {
        SheetFormReadout("Итого КД", maxOf(armor.minimum, subtotal).toString(), Glyph.Shield)
        SheetFormReadout(armor.baseName, armor.baseValue.toString())
        armor.shield?.let { SheetFormReadout(it.name, signed(armor.shieldValue)) }
        if (armor.shield == null) SheetFormReadout("Щит", "Не экипирован")
        armor.features.filter { it.second != 0 }.forEach { (name, value) -> SheetFormReadout(name, signed(value)) }
        if (manual != 0) SheetFormReadout("Дополнительные бонусы", signed(manual))
        if (armor.minimum > subtotal) SheetFormReadout("Минимальный КД", armor.minimum.toString())
    }
}

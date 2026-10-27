package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.dndshare.client.character.*
import ru.dndshare.designsystem.*

@Composable
internal fun CharacterPhoneToolbar(sheet: CharacterSheet, mechanics: DndDerivedValues, menu: () -> Unit) {
    val initiative = sheet.values["initiative"].objectValue()
    val value = initiative["base"].number() + initiative["bonuses"].bonusTotal() +
        (if (initiative["use_dex"]?.toString() == "true") abilityModifier(mechanics.score("DEX")) else 0) +
        mechanics.bonus("initiative_bonus", RuleContext(kind = "initiative"))
    val metrics = listOf("КД" to mechanics.armor.total.toString(), "ИНИЦ." to signed(value), "СКОР." to "${mechanics.speed()}фт",
        "БОНУС" to signed(sheet.proficiency()), "УР." to sheet.values["lvl"].objectValue()["level"].number(1).toString())
    Surface(color = WebPalette.Surface) {
        Row(Modifier.fillMaxWidth().height(48.dp), verticalAlignment = Alignment.CenterVertically) {
            metrics.forEach { (label, number) ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(label, fontSize = 9.sp, lineHeight = 11.sp, fontWeight = FontWeight.Bold, color = WebPalette.TextMuted)
                    Text(number, fontSize = 18.sp, lineHeight = 21.sp, fontWeight = FontWeight.Bold)
                }
                VerticalDivider(Modifier.height(48.dp))
            }
            IconButton(onClick = menu, modifier = Modifier.width(48.dp).semantics { contentDescription = "Меню персонажа" }) { AppGlyph(Glyph.Menu, Modifier.size(20.dp)) }
        }
    }
}

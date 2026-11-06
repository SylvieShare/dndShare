package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun WeaponUseMenuChoices(
    scope: String, uses: List<WeaponUseRule>, event: JsonObject, useKey: String, hitStep: String,
    enabled: Boolean, twoHanded: Boolean, chooseUse: (String) -> Unit, chooseHit: (String) -> Unit,
) {
    if (scope == "damage" && event.text("status") == "active") {
        val hits = event["steps"].arrayValue().map { it.objectValue() }.filter { it.text("kind") == "weapon_damage" }
        for (step in hits.filter { it.text("status") == "pending" }) {
            val label = if (hits.size == 1) event.text("title") else "${event.text("title")} · ${step.text("title")}"
            val key = step.text("key")
            WeaponOptionSwitch(label, hitStep == key, enabled) { chooseHit(if (it) key else "") }
        }
    } else for ((rule, _, error) in uses) {
        if (scope == "damage" && rule["steps"].arrayValue().count { it.objectValue().text("kind") == "weapon_damage" } != 1) continue
        val key = rule.text("key")
        val selected = key == useKey
        WeaponOptionSwitch(rule.text("title"), selected, enabled && (selected ||
            (error == null && useKey.isEmpty() && !(twoHanded && rule.text("attack_mode") == "thrown")))) {
            chooseUse(if (it) key else "")
        }
        val cost = rule["resource_cost"].number()
        if (error != null || cost > 0) Text(error ?: "Расход зарядов: $cost", style = ShareTypography.context, color = WebPalette.TextMuted)
    }
}

@Composable
internal fun WeaponStandaloneDamageSteps(
    uses: List<WeaponUseRule>, event: JsonObject, enabled: Boolean, roll: (String, String) -> Unit,
) {
    val active = event.text("status") == "active"
    val rows = if (active) listOf(event to true) else uses.map { it.rule to (it.error == null) }
    for ((use, available) in rows) for (raw in use["steps"].arrayValue()) {
        val step = raw.objectValue()
        if (step.text("kind") != "damage") continue
        val type = LocalCharacterSheet.current.metadata.suggests["12"]?.firstOrNull { it.id == step["damage_type"].referenceId() }
        val tag = type?.let { "{${it.value}|${it.color.orEmpty()}}" }.orEmpty()
        val expression = step.text("expression").ifBlank {
            val sign = if (step.text("sign") == "-") "-" else ""
            "$sign${step["dice_count"].number()}${step.text("dice")}$tag"
        }
        WeaponFormulaPreview(listOf(FormulaSource(use.text("title"), expression)))
        ShareDropdownMenuItem(
            text = { Text(step.text("title")) },
            onClick = { roll(use.text("key"), step.text("key")) },
            enabled = enabled && available && (!active || step.text("status") == "pending"),
            leadingIcon = { AppGlyph(Glyph.Dice, Modifier.size(18.dp)) },
        )
    }
}

package ru.dndshare.client.ui.character

import androidx.compose.material3.Text
import androidx.compose.runtime.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun StatusMechanicActions(status: StatusMechanic) {
    val context = LocalCharacterSheet.current
    var open by remember(status.uid) { mutableStateOf(false) }
    ShareTextButton({ open = true }) { Text(status.effect.name) }
    if (!open) return
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var confirmed by remember(status.uid) { mutableStateOf(false) }
    var dc by remember(status.uid, status.repeatDC) { mutableStateOf(status.repeatDC?.toString().orEmpty()) }
    suspend fun set(key: String, value: JsonPrimitive): Boolean {
        error = context.itemMechanic(status.uid, "status-parameter", buildJsonObject { put("key", key); put("value", value) })
        return error == null
    }
    fun roll(action: String, abilityId: Long?, title: String) {
        val ability = dndAbilities.firstOrNull { it.suggestId == abilityId }
        val rollContext = RuleContext(kind = "saving_throw", ability = abilityId)
        val stat = context.sheet.values[ability?.id].objectValue()
        val rank = if (stat["save_up"] == JsonPrimitive(true) || context.mechanics.rank("save_proficiency", rollContext) > 0) 1 else 0
        val bonus = ability?.let { context.mechanics.proficientRollTotal(it, rollContext, rank, stat["save_bonuses"]) } ?: 0
        open = false
        context.roll(SheetRollRequest(title, kind = if (action == "damage") "damage" else "saving_throw",
            ability = abilityId, bonus = bonus, proficiencyRank = rank,
            formula = if (action == "damage") "${status.count}${status.ongoing?.text("dice")}" else null,
            sourceItemId = status.effect.id, sourceName = status.effect.name,
            statusAction = status.bind(action, confirmed), repeatable = false))
    }
    ShareFormDialog(status.effect.name, { open = false }, dismissEnabled = !busy) {
        status.ongoing?.let { rule ->
            val action = if (status.damagePhase) "damage" else "save"
            val time = when (status.phase) {
                "initial_damage" -> "При употреблении"
                "initial_save" -> "После употребления"
                "turn_damage" -> "Начало хода"
                else -> "Конец хода"
            }
            val label = if (status.damagePhase) "${status.count}${rule.text("dice")}" else "спасбросок, Сл ${rule["save_dc"].number()}"
            ShareTextButton({ roll(action, rule["save_ability"].referenceId().takeUnless { status.damagePhase }, status.effect.name) },
                enabled = !busy && !context.rollBusy && status.count > 0) { Text("$time · $label") }
        }
        status.repeat?.let { rule ->
            val timing = when (rule.text("timing")) {
                "turn_start" -> "В начале хода"
                "action" -> "Действием"
                "custom" -> "По условию"
                else -> "В конце хода"
            }
            Text(timing, style = ShareTypography.context)
            if (rule["dc"].number() == 0 && (status.repeatDC == null || status.row["source"].objectValue().text("kind") == "manual")) {
                ShareNumberInput("Сложность", dc, !busy) { dc = it }
                if (dc.toIntOrNull() != status.repeatDC) ShareTextButton({
                    scope.launch {
                        busy = true
                        try { dc.toIntOrNull()?.let { set("save_dc", JsonPrimitive(it)) } } finally { busy = false }
                    }
                }, enabled = !busy && dc.toIntOrNull() in 1..100) { Text("Применить Сл") }
            }
            if (rule.text("condition").isNotBlank()) ShareToggle(rule.text("condition"), confirmed, !busy) { confirmed = it }
            ShareTextButton({
                roll("repeat", rule["ability"].referenceId(), "Повторный спасбросок · ${status.effect.name}")
            }, enabled = !busy && !context.rollBusy && status.repeatDC != null && dc.toIntOrNull() == status.repeatDC &&
                (rule.text("condition").isBlank() || confirmed)) {
                Text("Повторить спасбросок" + (status.repeatDC?.let { " · Сл $it" } ?: ""))
            }
        }
        if (status.effect.data["weapon_target"] is JsonObject) {
            val uid = status.params.text("weapon_uid")
            Text(if (uid.isBlank()) "Выбрать оружие" else "Выбранное оружие", style = ShareTypography.group)
            val options = statusWeapons(context.sheet, context.items, status).filter { uid.isBlank() || it.text("uid") == uid }
            if (options.isEmpty()) Text("Подходящего оружия нет", style = ShareTypography.context)
            for (weapon in options) {
                val name = weapon["override"].objectValue().text("name").ifBlank { resolveWeapon(weapon, context.items)?.name.orEmpty() }
                ShareTextButton({
                    scope.launch {
                        busy = true
                        try { if (set("weapon_uid", weapon.getValue("uid").jsonPrimitive)) open = false } finally { busy = false }
                    }
                }, enabled = !busy && uid.isBlank()) { Text(name) }
            }
        }
        error?.let { Text(it, color = WebPalette.Danger) }
    }
}

package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun WeaponUsePanel(uid: String, compact: Boolean = false, onlyKey: String? = null) {
    val context = LocalCharacterSheet.current
    val choices =
        weaponUseRules(context.sheet, uid, context.items).filter {
            onlyKey == null || it.rule.text("key") == onlyKey
        }
    val event =
        weaponUseState(context.sheet, uid)
            .takeIf { onlyKey == null || it.text("key") == onlyKey }
            .objectValue()
    if (compact) {
        val rows =
            choices.map { it.rule } +
                if (choices.isEmpty() && event.isNotEmpty()) listOf(event) else emptyList()
        rows.forEach { rule ->
            key(uid, rule.text("key")) {
                var expanded by
                    rememberSaveable(uid, rule.text("key")) {
                        mutableStateOf(
                            event.text("key") == rule.text("key") &&
                                event.text("status") == "active"
                        )
                    }
                LaunchedEffect(event.text("id"), event.text("status")) {
                    if (event.text("key") == rule.text("key") && event.text("status") == "active")
                        expanded = true
                }
                ShareActionDisclosure(
                    "Особое применение",
                    rule.text("title"),
                    expanded,
                    { expanded = it },
                    leading = { AppGlyph(Glyph.Swords, Modifier.size(24.dp), WebPalette.Accent) },
                ) {
                    WeaponUsePanel(uid, onlyKey = rule.text("key"))
                }
            }
        }
        return
    }
    if (choices.isEmpty() && event.isEmpty()) return
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var mode by rememberSaveable(uid) { mutableStateOf("auto") }
    var critical by
        rememberSaveable(uid, event.text("id"), event["attack_result"]) {
            mutableStateOf(event["critical"] == JsonPrimitive(true))
        }
    var confirm by remember { mutableStateOf(false) }
    fun action(operation: String, key: String = "") {
        if (busy) return
        busy = true
        scope.launch {
            try {
                error =
                    context.itemMechanic(
                        uid,
                        "weapon-use-$operation",
                        buildJsonObject {
                            put("id", event.text("id"))
                            put("key", key)
                            put("step", key)
                            put("mode", mode)
                            put("critical", critical)
                        },
                    )
            } finally {
                busy = false
            }
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (event.text("status") != "active") {
            if (context.canEdit && choices.isNotEmpty())
                ShareSelect("Режим атаки", mode, rollModeOptions, !busy) { mode = it }
            choices.forEach { choice ->
                ShareAction(
                    choice.rule.text("title") +
                        if (choice.rule["resource_cost"].number() > 0)
                            " · ${choice.rule["resource_cost"].number()} ${choice.resource?.title.orEmpty()}"
                        else "",
                    { action("start", choice.rule.text("key")) },
                    enabled = context.canEdit && !busy && !context.rollBusy && choice.error == null,
                )
                choice.error?.let {
                    Text(it, style = ShareTypography.context, color = WebPalette.TextMuted)
                }
            }
        }
        if (event.isNotEmpty()) {
            Text(event.text("title"), style = ShareTypography.group)
            event["attack_result"].objectValue()["total"]?.let {
                Text("Атака: ${it.number()}", style = ShareTypography.group)
            }
            if (event.text("status") == "active")
                ShareToggle("Критический урон", critical, context.canEdit && !busy) {
                    critical = it
                }
            event["steps"].arrayValue().forEach { raw ->
                val step = raw.objectValue()
                Text(step.text("title"), style = ShareTypography.group)
                val save = step["save"].objectValue()
                if (save.isNotEmpty())
                    Text(
                        "Спасбросок: ${dndAbilities.firstOrNull { it.suggestId == save["ability"].referenceId() }?.title.orEmpty()}, Сл ${save["dc"].number()}${if(save["half"]==JsonPrimitive(true)) " · половина урона при успехе" else ""}",
                        style = ShareTypography.context,
                    )
                val area = step["area"].objectValue()
                if (area.isNotEmpty())
                    Text(
                        "Линия ${area["length_ft"].number()} × ${area["width_ft"].number()} фт.",
                        style = ShareTypography.context,
                    )
                Text(
                    step.text(
                        if (critical && step.text("kind") == "weapon_damage") "critical_expression"
                        else "expression"
                    ),
                    style = ShareTypography.context,
                )
                when (step.text("status")) {
                    "rolled" ->
                        Text(
                            "Урон: ${step["result"].objectValue()["total"].number()}" +
                                step["half_result"]
                                    ?.let { " · половина: ${it.number()}" }
                                    .orEmpty(),
                            style = ShareTypography.group,
                        )
                    "missed" -> Text("Промах", style = ShareTypography.context)
                    else ->
                        if (event.text("status") == "active" && context.canEdit)
                            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                ShareTextButton(
                                    onClick = { action("step", step.text("key")) },
                                    enabled = !busy,
                                ) {
                                    Text("Бросить урон: ${step.text("title")}")
                                }
                                if (step.text("kind") == "weapon_damage")
                                    ShareTextButton(
                                        onClick = { action("miss", step.text("key")) },
                                        enabled = !busy,
                                    ) {
                                        Text("Промах")
                                    }
                            }
                }
            }
            if (event.text("status") == "active" && context.canEdit)
                ShareTextButton(onClick = { confirm = true }, enabled = !busy) {
                    Text("Завершить применение")
                }
        }
        if (busy) LinearProgressIndicator()
        error?.let { Text(it, color = WebPalette.Danger) }
    }
    if (confirm)
        ShareAlertDialog(
            onDismissRequest = { confirm = false },
            title = { Text("Завершить применение?") },
            text = { Text("Оставшиеся шаги будут закрыты. Потраченный ресурс не возвращается.") },
            confirmButton = {
                ShareTextButton(
                    onClick = {
                        confirm = false
                        action("finish")
                    }
                ) {
                    Text("Завершить")
                }
            },
            dismissButton = { ShareTextButton(onClick = { confirm = false }) { Text("Отмена") } },
        )
}

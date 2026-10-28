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
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun ConfirmedItemUsePanels(uid: String, compact: Boolean = false) {
    val context = LocalCharacterSheet.current
    val uses =
        remember(context.sheet, context.items, uid) {
            confirmedItemUses(context.sheet, context.items, uid)
        }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        uses.forEach { use ->
            key(uid, use.key) {
                val body: @Composable () -> Unit = {
                    if (!compact) Text(use.rule.text("title"), style = ShareTypography.group)
                    use.rule.text("description").takeIf(String::isNotBlank)?.let {
                        SheetDescription(it)
                    }
                    use.rule["requirements"].arrayValue().forEach {
                        Text("• ${it.jsonPrimitive.content}", style = ShareTypography.context)
                    }
                    if (context.canEdit)
                        context
                            .rerollForUse(uid, use.key)
                            ?.takeIf { offer ->
                                offer.useEventId.isBlank() ||
                                    weaponUseState(context.sheet, offer.useTargetUid).let {
                                        it.text("id") == offer.useEventId &&
                                            it.text("status") == "active"
                                    }
                            }
                            ?.let { offer ->
                                ShareAction(
                                    "Перебросить: " + offer.title,
                                    { context.reroll(offer) },
                                    enabled = !busy && !context.rollBusy && use.error.isBlank(),
                                )
                            }
                    if (context.canEdit)
                        ShareAction(
                            "${use.rule.text("confirm_label")} · −${use.cost} заряд",
                            {
                                if (!busy) {
                                    busy = true
                                    scope.launch {
                                        try {
                                            error =
                                                context.itemMechanic(
                                                    uid,
                                                    "confirmed-use",
                                                    buildJsonObject { put("key", use.key) },
                                                )
                                        } finally {
                                            busy = false
                                        }
                                    }
                                }
                            },
                            enabled = !busy && use.error.isBlank(),
                        )
                    if (use.error.isNotBlank())
                        Text(
                            use.error,
                            style = ShareTypography.context,
                            color = WebPalette.TextMuted,
                        )
                }
                if (compact) {
                    var expanded by rememberSaveable(uid, use.key) { mutableStateOf(false) }
                    val resource =
                        use.resource?.takeIf { candidate ->
                            uses.firstOrNull { it.resource?.key == candidate.key }?.key == use.key
                        }
                    ShareActionDisclosure(
                        "Применение по условию",
                        use.rule.text("title"),
                        expanded,
                        { expanded = it },
                        leading = {
                            AppGlyph(Glyph.CircleCheck, Modifier.size(24.dp), WebPalette.Accent)
                        },
                        trailing = {
                            if (resource != null) ItemResourceOrbs(resource, { error = it })
                        },
                    ) {
                        body()
                    }
                } else body()
            }
        }
        error?.let { Text(it, style = ShareTypography.context, color = WebPalette.Danger) }
    }
}

@Composable
internal fun LastChargePanel(uid: String) {
    val context = LocalCharacterSheet.current
    val check = lastChargeCheck(context.sheet, uid)
    val entry =
        inventoryInstances(context.sheet).firstOrNull { it.first.text("uid") == uid }?.first
            ?: return
    val lost = entry["params"].objectValue()["magic"].objectValue()["lost"] == JsonPrimitive(true)
    if (check.text("status") != "pending" && !lost) return
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var confirming by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    fun action(operation: String) {
        if (busy) return
        busy = true
        scope.launch {
            try {
                error =
                    context.itemMechanic(
                        uid,
                        "last-charge-$operation",
                        buildJsonObject { put("id", check.text("id")) },
                    )
            } finally {
                busy = false
            }
        }
    }
    Column(
        Modifier.fillMaxWidth().padding(top = 8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(
            if (lost) "Магические свойства утрачены" else "Проверка последнего заряда",
            style = ShareTypography.group,
        )
        val rule = check["rule"].objectValue()
        if (lost)
            Text(
                "Предмет сохраняет обычную основу. Заряды не восстанавливаются.",
                style = ShareTypography.context,
            )
        else
            Text(
                "${rule.text("dice")}: при результате ${rule["failure_max"].number()} или меньше магия предмета утрачивается.",
                style = ShareTypography.context,
            )
        if (context.canEdit)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (check.text("status") == "pending")
                    TextButton({ action("roll") }, enabled = !busy && lastChargeRuleValid(rule)) {
                        Text("Проверить")
                    }
                TextButton({ confirming = true }, enabled = !busy) {
                    Text(if (lost) "Отменить утрату магии" else "Отменить проверку")
                }
            }
        error?.let { Text(it, color = WebPalette.Danger, style = ShareTypography.context) }
    }
    if (confirming)
        AlertDialog(
            onDismissRequest = { confirming = false },
            title = { Text("Отменить проверку?") },
            text = {
                Text(
                    "Будет отменено ошибочное применение. Потраченные заряды не возвращаются, повторного броска этой проверки не будет."
                )
            },
            confirmButton = {
                TextButton({
                    confirming = false
                    action("undo")
                }) {
                    Text("Подтвердить")
                }
            },
            dismissButton = { TextButton({ confirming = false }) { Text("Отмена") } },
        )
}

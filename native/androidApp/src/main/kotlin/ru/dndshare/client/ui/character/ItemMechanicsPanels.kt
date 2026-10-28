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
internal fun ItemMechanicsPanels(entry: JsonObject, compact: Boolean = false) {
    if (entry["item_id"] == null && entry["magic_item_id"] == null) return
    val context = LocalCharacterSheet.current
    val creation = entry["params"].objectValue()["creation"] as? JsonObject
    if (creation != null)
        Text(
            if (creation["expired"] == JsonPrimitive(true)) "Магия закончилась"
            else
                "Создано магией · ${statusDurationLabel(creation["duration"])}${if(creation.text("on_expire")=="vanish")" · затем исчезает" else ""}",
            style = ShareTypography.context,
            color = WebPalette.TextMuted,
        )
    if (creation?.get("expired") == JsonPrimitive(true)) return
    val uid = entry.text("uid")
    val item = context.items[(entry["magic_item_id"] ?: entry["item_id"]).referenceId()] ?: return
    val source =
        remember(context.sheet, context.items, uid) {
            selectedWeaponTargets(context.sheet, context.items).firstOrNull { it.uid == uid }
        }
    if (source != null && (source.active || source.state.isNotEmpty())) {
        if (compact) {
            var open by rememberSaveable(uid, "target") { mutableStateOf(false) }
            ShareActionDisclosure(
                "Выбранная цель",
                source.rule.text("title"),
                open,
                { open = it },
                leading = { AppGlyph(Glyph.Target, Modifier.size(24.dp), WebPalette.Accent) },
            ) {
                SelectedTargetPanel(source)
            }
        } else SelectedTargetPanel(source)
    }
    weaponBonusTransfer(context.sheet, entry, item)?.let {
        if (compact) {
            var open by rememberSaveable(uid, "transfer") { mutableStateOf(false) }
            ShareActionDisclosure(
                "Перенос бонуса в защиту",
                it.title,
                open,
                { open = it },
                leading = { AppGlyph(Glyph.ShieldCheck, Modifier.size(24.dp), WebPalette.Info) },
                color = WebPalette.Info,
            ) {
                BonusTransferPanel(uid, it)
            }
        } else BonusTransferPanel(uid, it)
    }
    ConfirmedItemUsePanels(uid, compact)
    LastChargePanel(uid)
    WeaponUsePanel(uid, compact)
}

@Composable
private fun SelectedTargetPanel(source: SelectedWeaponTarget) {
    val context = LocalCharacterSheet.current
    val scope = rememberCoroutineScope()
    var name by rememberSaveable(source.uid) { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var confirming by remember { mutableStateOf<String?>(null) }
    val inputs = remember(source.uid) { ShareFormInputs() }
    fun perform(operation: String, body: JsonObject) {
        if (busy) return
        busy = true
        scope.launch {
            error = context.itemMechanic(source.uid, "target-$operation", body)
            if (error == null && operation == "declare") name = ""
            busy = false
        }
    }
    CompositionLocalProvider(LocalShareFormInputs provides inputs) {
        Column(
            Modifier.fillMaxWidth().padding(top = 10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(source.rule.text("title"), style = ShareTypography.group)
            val state = source.state
            if (state.isNotEmpty()) {
                Text(state.text("name"), style = ShareTypography.group)
                Text(
                    when (state.text("status")) {
                        "active" -> "Осталось рассветов: ${state["dawns_left"].number()}"
                        "defeated" ->
                            "Цель погибла. До новой цели: ${state["dawns_left"].number()} рассветов."
                        "expired" -> "Срок истёк. Можно объявить новую цель."
                        else -> "Ожидание завершено. Можно объявить новую цель."
                    },
                    style = ShareTypography.context,
                    color = WebPalette.TextMuted,
                )
                if (
                    state.text("status") == "active" &&
                        source.rule["other_weapons_disadvantage"] == JsonPrimitive(true)
                )
                    Text("Другим оружием — с помехой", style = ShareTypography.context)
                if (!source.active)
                    Text("Свойства для этой цели сейчас неактивны", style = ShareTypography.context)
            }
            if (context.canEdit && source.active && source.available) {
                key(state.text("id")) {
                    ShareTextInput(name, { name = it }, "Имя противника", enabled = !busy)
                }
                ShareAction(
                    "Объявить цель",
                    {
                        inputs.flush()
                        perform("declare", buildJsonObject { put("name", name) })
                    },
                    enabled = !busy && name.isNotBlank(),
                )
            }
            source.rule.text("condition").takeIf(String::isNotBlank)?.let { SheetDescription(it) }
            if (context.canEdit && state.isNotEmpty())
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (state.text("status") == "active")
                        TextButton(onClick = { confirming = "defeat" }, enabled = !busy) {
                            Text("Враг погиб")
                        }
                    TextButton(onClick = { confirming = "correct" }, enabled = !busy) {
                        Text("Исправить выбор")
                    }
                }
            error?.let { Text(it, color = WebPalette.Danger, style = ShareTypography.context) }
        }
    }
    confirming?.let { operation ->
        AlertDialog(
            onDismissRequest = { confirming = null },
            title = {
                Text(if (operation == "defeat") "Враг погиб?" else "Сбросить ошибочный выбор?")
            },
            text = {
                Text(
                    if (operation == "defeat")
                        "Эффекты цели прекратятся. Ожидание новой цели: ${source.rule["cooldown_dawns"].number()} рассветов."
                    else
                        "Это исправление снимет эффекты и ожидание. Для обычного завершения используйте «Враг погиб» или дождитесь истечения срока."
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirming = null
                        perform(operation, buildJsonObject { put("id", source.state.text("id")) })
                    }
                ) {
                    Text("Подтвердить")
                }
            },
            dismissButton = { TextButton(onClick = { confirming = null }) { Text("Отмена") } },
        )
    }
}

@Composable
private fun BonusTransferPanel(uid: String, transfer: WeaponBonusTransfer) {
    val context = LocalCharacterSheet.current
    val scope = rememberCoroutineScope()
    var amount by
        remember(uid, transfer.selected) { mutableFloatStateOf(transfer.selected.toFloat()) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    Column(
        Modifier.fillMaxWidth().padding(top = 10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(transfer.title, style = ShareTypography.group)
        Text(
            "Атака / урон: +${transfer.max - amount.toInt()} · защита: +${amount.toInt()}",
            style = ShareTypography.context,
        )
        Slider(
            amount,
            { amount = it },
            valueRange = 0f..transfer.max.toFloat(),
            steps = (transfer.max - 1).coerceAtLeast(0),
            enabled = context.canEdit && transfer.active && !busy,
            onValueChangeFinished = {
                busy = true
                scope.launch {
                    error =
                        context.itemMechanic(
                            uid,
                            "bonus-transfer",
                            buildJsonObject { put("amount", amount.toInt()) },
                        )
                    busy = false
                }
            },
        )
        transfer.condition.takeIf(String::isNotBlank)?.let { SheetDescription(it) }
        if (!transfer.active) Text("Перенос сейчас неактивен", style = ShareTypography.context)
        error?.let { Text(it, color = WebPalette.Danger, style = ShareTypography.context) }
    }
}

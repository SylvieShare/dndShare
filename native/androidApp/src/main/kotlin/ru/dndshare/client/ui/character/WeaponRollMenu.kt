package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun WeaponRollMenu(uid: String, scope: String) {
    val context = LocalCharacterSheet.current
    val target = context.weaponMenuTarget
    val expanded = context.canEdit && (target == "weapon-roll:$uid|$scope" ||
        (scope == "attack" && target == "weapon-roll:$uid"))
    ShareDropdownMenu(expanded, context.dismissWeaponMenu, Modifier.width(DesignTokens.Layout.RollModeMenuWidth)) {
        WeaponRollSettings(uid, scope)
    }
}

@Composable
private fun WeaponRollSettings(uid: String, scope: String) {
    val context = LocalCharacterSheet.current
    val busy = context.rollBusy
    val entry = inventoryInstances(context.sheet).firstOrNull { it.first.text("uid") == uid }?.first ?: return
    val initialActions =
        remember(context.sheet, context.items, entry) {
            weaponDamageActions(context.sheet, entry, context.items, context.metadata)
        }
    var keys by
        rememberSaveable(uid) {
            mutableStateOf(
                initialActions
                    .filter { it["target_choice"].objectValue()["selected"] == JsonPrimitive(true) }
                    .map { it.text("key") }
            )
        }
    var amounts by rememberSaveable(uid) { mutableStateOf("{}") }
    var critical by rememberSaveable(uid) { mutableStateOf(false) }
    var twoHanded by rememberSaveable(uid) { mutableStateOf(false) }
    var bonusAction by rememberSaveable(uid) { mutableStateOf(false) }
    var mode by rememberSaveable(uid) { mutableStateOf("auto") }
    var excluded by rememberSaveable(uid) { mutableStateOf(emptyList<String>()) }
    val uses = remember(context.sheet, context.items, uid) { weaponUseRules(context.sheet, uid, context.items) }
    val event = weaponUseState(context.sheet, uid)
    val activeUse = event.text("status") == "active"
    var useKey by rememberSaveable(uid) { mutableStateOf("") }
    var hitStep by rememberSaveable(uid, event.text("id")) { mutableStateOf("") }
    val special = uses.firstOrNull { it.rule.text("key") == useKey }
    val thrown = special?.rule?.text("attack_mode") == "thrown" ||
        (hitStep.isNotBlank() && event.text("attack_mode") == "thrown") ||
        selectedWeaponDamageRules(initialActions, keys).any { it.text("attack_mode") == "thrown" }
    val weapon =
        remember(context.sheet, context.items, entry, thrown) {
            weaponReadout(context.sheet, entry, context.items, context.metadata, thrown)
        }
    if (weapon == null) {
        Text("Дождитесь загрузки оружия из справочника.", Modifier.padding(8.dp))
        return
    }
    val amountMap = WireJson.parseToJsonElement(amounts).jsonObject.mapValues { it.value.number() }
    val options =
        WeaponRollOptions(keys, amountMap, critical, twoHanded, bonusAction, mode, excluded,
            useKey = useKey, useEventId = if (hitStep.isBlank()) "" else event.text("id"), hitStep = hitStep)
    val plan = if (scope == "attack") null else
        remember(context.sheet, context.items, context.metadata, options) {
            runCatching {
                weaponDamagePlan(context.sheet, uid, options, context.items, context.metadata)
            }
        }
    val offhand =
        twoWeaponAbilityModifier(context.sheet, weapon, context.items, context.metadata, thrown)
    Column(Modifier.fillMaxWidth().padding(8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (scope == "attack") SheetRollModePicker(mode, { mode = it }, neutralMode = "auto", enabled = !busy)
        if (scope != "attack") WeaponOptionSwitch("Критическое попадание", critical, !busy) { critical = it }
        if (scope == "damage" && weapon.twoHanded.isNotEmpty())
            WeaponOptionSwitch("Двумя руками", twoHanded, !busy && !thrown && !bonusAction && special == null && hitStep.isBlank()) {
                twoHanded = it
            }
        if (scope == "damage" && offhand != null && special == null && hitStep.isBlank())
            WeaponOptionSwitch("Урон бонусным действием", bonusAction, !busy) {
                bonusAction = it
                if (it) twoHanded = false
            }
        if (bonusAction)
            Text(
                if (offhand == true) "Модификатор характеристики сохраняется."
                else
                    "Положительный модификатор характеристики не добавляется; отрицательный и остальные бонусы сохраняются.",
                style = ShareTypography.context,
            )
        val visibleActions = if (scope == "damage") initialActions else attackMenuRules(initialActions)
        visibleActions.filter { special == null || it.text("attack_mode").isBlank() && scope == "damage" }.forEach { rule ->
            val key = rule.text("key")
            val selected =
                selectedWeaponDamageRules(initialActions, keys).any { it.text("key") == key }
            val parent = rule.text("requires_damage_key")
            val enabled =
                !busy &&
                    (parent.isBlank() ||
                        selectedWeaponDamageRules(initialActions, keys).any {
                            it.text("key") == parent
                        }) &&
                    !(twoHanded && rule.text("attack_mode") == "thrown")
            WeaponOptionSwitch(
                rule
                    .text("label")
                    .ifBlank { rule.text("source_label") }
                    .ifBlank { "Дополнительный урон" },
                selected,
                enabled,
            ) { checked ->
                keys =
                    selectedWeaponDamageRules(
                            initialActions,
                            if (checked) keys + key else keys - key,
                        )
                        .map { it.text("key") }
                if (checked && rule.text("attack_mode") == "thrown") {
                    twoHanded = false
                    bonusAction = false
                }
            }
            (if (scope == "attack") rule.text("attack_condition").ifBlank { rule.text("condition") } else rule.text("condition")).takeIf(String::isNotBlank)?.let { SheetDescription(it) }
            val max = rule["resource_units_max"].number()
            if (scope == "damage" && selected && max in 2..20)
                ShareSelect(
                    "Количество зарядов",
                    (amountMap[key] ?: 0).toString(),
                    (0..max).map { it.toString() to it.toString() },
                    !busy,
                ) { value ->
                    amounts =
                        JsonObject(
                                WireJson.parseToJsonElement(amounts).jsonObject +
                                    (key to JsonPrimitive(value.toInt()))
                            )
                            .toString()
                    if (value == "0") keys = keys - key
                }
        }
        if (scope == "attack") {
            val item = context.items[(entry["magic_item_id"] ?: entry["item_id"]).referenceId()]
            val transfer = item?.let { weaponBonusTransfer(context.sheet, entry, it) }
            if (transfer?.active == true) ShareSelect(
                transfer.title, transfer.value.toString(),
                (0..transfer.max).map { it.toString() to "+$it к КД" }, !busy,
            ) { context.weaponAction(uid, "bonus-transfer", buildJsonObject { put("amount", it.toInt()) }) }
        }
        WeaponUseMenuChoices(scope, uses, event, useKey, hitStep, !busy, twoHanded,
            chooseUse = {
                useKey = it
                if (it.isNotBlank()) { keys = emptyList(); twoHanded = false; bonusAction = false }
            },
            chooseHit = {
                hitStep = it
                if (it.isNotBlank()) { twoHanded = false; bonusAction = false }
            },
        )
        val rollContext =
            RuleContext(
                kind = "attack",
                ability = weapon.ability,
                target = entry["uid"],
                weaponAttack = true,
                weaponKind =
                    if (thrown || weapon.item.data["is_long_range"] == JsonPrimitive(true)) "ranged"
                    else "melee",
            )
        if (scope != "damage") context.mechanics.rules("roll_bonus", rollContext).forEach { source ->
            val key = source.rule.text("key")
            WeaponOptionSwitch(
                "${source.sourceLabel}: ${source.rule.text("formula")}",
                key !in excluded,
                !busy,
            ) { checked ->
                excluded = if (checked) excluded - key else excluded + key
            }
        }
        if (scope == "damage") plan?.getOrNull()?.let { ready ->
            Text("Урон: ${ready.request.formula}", style = ShareTypography.group)
            ready.costs.forEach {
                Text(
                    "${it.resource.title}: −${it.amount} · останется ${it.resource.value - it.amount}",
                    style = ShareTypography.context,
                )
            }
        }
        if (scope == "damage") plan?.exceptionOrNull()?.message?.let {
            Text(it, color = WebPalette.Warning, style = ShareTypography.context)
        }
        ShareDropdownMenuItem(
            text = { Text(if (scope == "attack") "Бросить на атаку" else "Бросить на урон") },
            onClick = { context.rollWeapon(uid, scope, options) },
            leadingIcon = { AppGlyph(if (scope == "attack") Glyph.Target else Glyph.Swords, Modifier.size(18.dp)) },
            enabled = !busy && context.canEdit && (scope == "attack" && (useKey.isBlank() || special != null && special.error == null) || plan?.isSuccess == true),
        )
        if (scope == "damage") WeaponStandaloneDamageSteps(uses, event, !busy) { key, step ->
            context.weaponAction(uid, if (activeUse) "weapon-use-step" else "weapon-use-direct-step",
                buildJsonObject {
                    put("key", key)
                    put("step", step)
                    put("id", event.text("id"))
                })
        }
    }
}

private fun attackMenuRules(actions: List<JsonObject>): List<JsonObject> {
    val byKey = actions.associateBy { it.text("key") }
    val keys = mutableSetOf<String>()
    for (rule in actions.filter { it.text("attack_mode") == "thrown" || it["target_choice"] is JsonObject }) {
        var key = rule.text("key")
        while (key.isNotBlank() && keys.add(key)) key = byKey[key]?.text("requires_damage_key").orEmpty()
    }
    return actions.filter { it.text("key") in keys }
}

@Composable
internal fun WeaponOptionSwitch(
    title: String,
    selected: Boolean,
    enabled: Boolean,
    change: (Boolean) -> Unit,
) = ShareToggle(title, selected, enabled, change = change)

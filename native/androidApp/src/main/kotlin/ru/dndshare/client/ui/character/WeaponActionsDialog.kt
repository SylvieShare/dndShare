package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun WeaponActionsDialog(
    uid: String,
    busy: Boolean,
    close: () -> Unit,
    attack: (WeaponRollOptions) -> Unit,
    damage: (WeaponRollOptions) -> Unit,
) {
    val context = LocalCharacterSheet.current
    val entry = inventoryInstances(context.sheet).firstOrNull { it.first.text("uid") == uid }?.first
    if (entry == null) {
        ShareFormDialog("Оружие недоступно", close) {
            Text("Предмет больше не принадлежит персонажу.")
        }
        return
    }
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
    val thrown =
        selectedWeaponDamageRules(initialActions, keys).any { it.text("attack_mode") == "thrown" }
    val weapon =
        remember(context.sheet, context.items, entry, thrown) {
            weaponReadout(context.sheet, entry, context.items, context.metadata, thrown)
        }
    if (weapon == null) {
        ShareFormDialog("Оружие", close) {
            Text("Сначала загрузите описание оружия из справочника.")
        }
        return
    }
    val amountMap = WireJson.parseToJsonElement(amounts).jsonObject.mapValues { it.value.number() }
    val options =
        WeaponRollOptions(keys, amountMap, critical, twoHanded, bonusAction, mode, excluded)
    val plan =
        remember(context.sheet, context.items, options) {
            runCatching {
                weaponDamagePlan(context.sheet, uid, options, context.items, context.metadata)
            }
        }
    val offhand =
        twoWeaponAbilityModifier(context.sheet, weapon, context.items, context.metadata, thrown)
    ShareFormDialog(
        weapon.item.name,
        close,
        dismissEnabled = !busy,
        actions = {
            ShareTextButton(close, enabled = !busy) { Text("Закрыть") }
            ShareButton(
                onClick = { damage(options) },
                enabled = !busy && context.canEdit && plan.isSuccess,
            ) {
                Text("Бросить урон")
            }
        },
    ) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                    "auto" to "Авто",
                    "normal" to "Обычно",
                    "advantage" to "Преимущество",
                    "disadvantage" to "Помеха",
                )
                .forEach { (value, title) ->
                    ShareChoiceChip(
                        mode == value,
                        { mode = value },
                        label = { Text(title) },
                        enabled = !busy,
                    )
                }
        }
        ShareAction(
            "Атака ${signed(weapon.attack)}",
            { attack(options) },
            enabled = !busy && context.canEdit,
        )
        WeaponOptionSwitch("Критический урон", critical, !busy) { critical = it }
        if (weapon.twoHanded.isNotEmpty())
            WeaponOptionSwitch("Хват двумя руками", twoHanded, !busy && !thrown && !bonusAction) {
                twoHanded = it
            }
        if (offhand != null)
            WeaponOptionSwitch("Бонусная атака другим оружием", bonusAction, !busy) {
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
        initialActions.forEach { rule ->
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
            rule.text("condition").takeIf(String::isNotBlank)?.let { SheetDescription(it) }
            val max = rule["resource_units_max"].number()
            if (selected && max in 2..20)
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
        context.mechanics.rules("roll_bonus", rollContext).forEach { source ->
            val key = source.rule.text("key")
            WeaponOptionSwitch(
                "${source.sourceLabel}: ${source.rule.text("formula")}",
                key !in excluded,
                !busy,
            ) { checked ->
                excluded = if (checked) excluded - key else excluded + key
            }
        }
        plan.getOrNull()?.let { ready ->
            Text("Урон: ${ready.request.formula}", style = ShareTypography.group)
            ready.costs.forEach {
                Text(
                    "${it.resource.title}: −${it.amount} · останется ${it.resource.value - it.amount}",
                    style = ShareTypography.context,
                )
            }
        }
        plan.exceptionOrNull()?.message?.let {
            Text(it, color = WebPalette.Warning, style = ShareTypography.context)
        }
    }
}

@Composable
internal fun WeaponOptionSwitch(
    title: String,
    selected: Boolean,
    enabled: Boolean,
    change: (Boolean) -> Unit,
) = ShareToggle(title, selected, enabled, change = change)

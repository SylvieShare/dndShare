package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun SpellActionsDialog(
    key: String,
    busy: Boolean,
    close: () -> Unit,
    initial: SpellRollOptions? = null,
    roll: (SpellRollOptions) -> Unit,
) {
    val context = LocalCharacterSheet.current
    val result =
        remember(context.sheet, context.items, key) {
            runCatching { spellReadout(context.sheet, key, context.items, context.metadata) }
        }
    val readout = result.getOrNull()
    if (readout == null) {
        ShareFormDialog("Заклинание", close) {
            Text(result.exceptionOrNull()?.message ?: "Заклинание недоступно.")
        }
        return
    }
    val rules = remember(readout.item) { spellRuleOptions(readout.item) }
    val base = readout.item.data["lvl"].number()
    var level by
        rememberSaveable(key) {
            mutableIntStateOf(
                initial?.castLevel?.takeIf { it in base..9 && (base != 0 || it == 0) }
                    ?: readout.reference["cast_level"].number(base).coerceAtLeast(base)
            )
        }
    var selected by
        rememberSaveable(key) {
            mutableStateOf(
                initial?.optionKey?.takeIf { chosen -> rules.any { it.key == chosen } }
                    ?: rules.firstOrNull()?.key.orEmpty()
            )
        }
    var critical by rememberSaveable(key) { mutableStateOf(initial?.critical ?: false) }
    var mode by rememberSaveable(key) { mutableStateOf(initial?.mode ?: "auto") }
    var excluded by
        rememberSaveable(key) { mutableStateOf(initial?.excludedBonuses ?: emptyList()) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val rule = rules.firstOrNull { it.key == selected }
    val allowed =
        rule?.rule?.get("type_choices").arrayValue().mapNotNull { it.referenceId() }.distinct()
    val attackAllowed =
        readout.item.data["damage"]
            .objectValue()["type_choices"]
            .arrayValue()
            .mapNotNull { it.referenceId() }
            .distinct()
    fun typeKey(ids: List<Long>) = ids.sorted().joinToString(",")
    var types by
        rememberSaveable(key) {
            mutableStateOf(
                buildJsonObject {
                    initial?.typeChoices?.forEach { (name, id) -> put(name, id) }
                    initial?.damageType?.let { id ->
                        if (id in allowed) put(typeKey(allowed), id)
                        if (id in attackAllowed) put(typeKey(attackAllowed), id)
                    }
                }
                    .toString()
            )
        }
    fun selectedType(ids: List<Long>) =
        WireJson.parseToJsonElement(types).jsonObject[typeKey(ids)].referenceId()?.takeIf {
            it in ids
        } ?: ids.singleOrNull()
    fun selectType(ids: List<Long>, raw: String) {
        types =
            JsonObject(
                    WireJson.parseToJsonElement(types).jsonObject +
                        (typeKey(ids) to JsonPrimitive(raw.toLong()))
                )
                .toString()
    }
    val damageType = selectedType(allowed)
    val attackType = selectedType(attackAllowed)
    val options =
        SpellRollOptions(
            kind = rule?.kind ?: "effect",
            optionKey = selected,
            castLevel = level,
            critical = critical && rule?.kind != "heal",
            damageType = damageType,
            mode = mode,
            excludedBonuses = excluded,
            typeChoices =
                WireJson.parseToJsonElement(types).jsonObject.mapValues {
                    it.value.jsonPrimitive.long
                },
        )
    val plan =
        remember(context.sheet, context.items, options) {
            runCatching {
                spellRollRequest(context.sheet, key, options, context.items, context.metadata)
            }
        }
    val blocked = spellCastingBlocked(context.sheet, context.items, context.metadata)
    CompositionLocalProvider(
        ru.dndshare.client.ui.LocalRichInteractions provides
            spellRichInteractions(
                ru.dndshare.client.ui.LocalRichInteractions.current,
                readout,
                level,
            )
    ) {
        ShareFormDialog(
            readout.item.name,
            close,
            dismissEnabled = !busy && !saving,
            actions = {
                TextButton(close, enabled = !busy && !saving) { Text("Закрыть") }
                if (rules.isNotEmpty())
                    Button(
                        onClick = { roll(options) },
                        enabled = context.canEdit && !busy && !saving && plan.isSuccess,
                    ) {
                        Text(
                            "Бросить ${if(rule?.kind=="heal")"лечение" else if(rule?.kind=="damage")"урон" else "эффект"}"
                        )
                    }
            },
        ) {
            if (base == 0) Text("Заговор", style = ShareTypography.group)
            else if (readout.reference["slotless"] == JsonPrimitive(true))
                Text("${level} круг · без ячейки", style = ShareTypography.group)
            else
                ShareSelect(
                    "Круг броска",
                    level.toString(),
                    (base..9).map { it.toString() to "$it круг" },
                    !busy && !saving,
                ) {
                    level = it.toInt()
                }
            ShareStats(
                listOf(
                    ShareStat("СЛ спасброска", readout.save.toString()),
                    ShareStat("Атака", signed(readout.attack)),
                )
            )
            if (blocked)
                Text(
                    "Активный эффект или отсутствие владения доспехом запрещает сотворение заклинаний.",
                    color = WebPalette.Warning,
                    style = ShareTypography.context,
                )
            if (readout.item.data["damage"].objectValue()["range_attack"] == JsonPrimitive(true)) {
                ShareSelect("Режим атаки", mode, rollModeOptions, !busy && !saving) { mode = it }
                if (attackAllowed.isNotEmpty())
                    ShareSelect(
                        "Тип урона атаки",
                        attackType?.toString().orEmpty(),
                        attackAllowed.map { id ->
                            id.toString() to
                                (context.metadata.suggests["12"]?.firstOrNull { it.id == id }?.value
                                    ?: "Тип $id")
                        },
                        !busy && !saving,
                    ) {
                        selectType(attackAllowed, it)
                    }
                context.mechanics
                    .rules("roll_bonus", RuleContext(kind = "attack", ability = readout.ability))
                    .forEach { source ->
                        val id = source.rule.text("key")
                        ShareToggle(
                            "${source.sourceLabel}: ${source.rule.text("formula")}",
                            id !in excluded,
                            !busy && !saving,
                        ) { checked ->
                            excluded = if (checked) excluded - id else excluded + id
                        }
                    }
                ShareAction(
                    "Атака ${signed(readout.attack)}",
                    { roll(options.copy(kind = "attack", damageType = attackType)) },
                    enabled =
                        context.canEdit &&
                            !busy &&
                            !saving &&
                            !blocked &&
                            (attackAllowed.isEmpty() || attackType != null),
                )
            }
            if (rules.isNotEmpty())
                ShareSelect(
                    "Вариант броска",
                    selected,
                    rules.map { it.key to it.label },
                    !busy && !saving,
                ) {
                    selected = it
                }
            if (
                allowed.isNotEmpty() &&
                    (readout.item.data["damage"].objectValue()["range_attack"] !=
                        JsonPrimitive(true) || typeKey(allowed) != typeKey(attackAllowed))
            )
                ShareSelect(
                    "Тип урона",
                    damageType?.toString().orEmpty(),
                    allowed.map { id ->
                        id.toString() to
                            (context.metadata.suggests["12"]?.firstOrNull { it.id == id }?.value
                                ?: "Тип $id")
                    },
                    !busy && !saving,
                ) {
                    selectType(allowed, it)
                }
            if (rule?.kind == "damage")
                ShareToggle("Критический урон", critical, !busy && !saving) { critical = it }
            plan.getOrNull()?.formula?.let { Text(it, style = ShareTypography.group) }
            run {
                val damage = rule?.rule ?: readout.item.data["damage"].objectValue()
                val instances =
                    (damage["instances"].number(1) +
                            damage["addon_instances"].number() *
                                spellScalingSteps(damage, base, level, readout.characterLevel))
                        .coerceAtLeast(1)
                if (instances > 1)
                    Text(
                        "Количество лучей или снарядов: $instances. Формула рассчитана на одно попадание.",
                        style = ShareTypography.context,
                    )
                val save = spellSavingThrow(damage, readout, context.sheet)
                save?.let {
                    val ability =
                        dndAbilities
                            .firstOrNull { ability ->
                                ability.suggestId == it["ability"].referenceId()
                            }
                            ?.title
                            .orEmpty()
                    Text(
                        "Спасбросок: $ability · Сл ${it["dc"].number()}${if(it.text("onSuccess")=="half")" · половина урона при успехе" else ""}",
                        style = ShareTypography.context,
                    )
                    TextButton(
                        onClick = {
                            saving = true
                            scope.launch {
                                try {
                                    error =
                                        context.itemMechanic(
                                            key,
                                            "spell-save",
                                            WireJson.parseToJsonElement(
                                                    WireJson.encodeToString(options)
                                                )
                                                .jsonObject,
                                        )
                                } finally {
                                    saving = false
                                }
                            }
                        },
                        enabled =
                            context.canEdit &&
                                !blocked &&
                                !busy &&
                                !saving &&
                                context.sessionUuid != null,
                    ) {
                        Text("Запросить спасбросок")
                    }
                }
                damage.text("save_condition").takeIf(String::isNotBlank)?.let {
                    SheetDescription(it)
                }
            }
            if (rules.isNotEmpty())
                plan.exceptionOrNull()?.message?.let {
                    Text(it, color = WebPalette.Warning, style = ShareTypography.context)
                }
            TextButton(
                onClick = { context.edit("spell-cast:$key") },
                enabled = context.canEdit && !busy && !saving && !blocked,
            ) {
                Text("Сотворить заклинание")
            }
            error?.let { Text(it, color = WebPalette.Danger) }
        }
    }
}

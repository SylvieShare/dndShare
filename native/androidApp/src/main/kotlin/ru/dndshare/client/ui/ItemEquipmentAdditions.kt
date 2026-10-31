package ru.dndshare.client.ui

import androidx.compose.runtime.Composable
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun EquipmentAdditions(item: CatalogueItem, kind: String, metadata: HandbookMetadata) {
    val d = item.data
    val rule = d[kind].objectValue()
    val cards = mutableListOf<@Composable () -> Unit>()
    fun names(type: Long, raw: JsonElement?) =
        raw.arrayValue()
            .map { metadata.suggest(it.referenceId() ?: 0, type)?.value ?: "Название недоступно" }
            .joinToString(", ")
    fun fact(
        label: String,
        value: String,
        note: String = "",
        glyph: Glyph = Glyph.Wand,
        bonus: Boolean = false,
    ) {
        cards += { EquipmentFact(label, value, note, glyph, bonus) }
    }
    val bonus = rule["magic_bonus"].number()
    if (bonus != 0)
        fact(
            if (kind == "weapon") "К броскам атаки и урона" else "К классу доспеха",
            signed(bonus),
            listOfNotNull(
                    if (d.text("attunement") != "none")
                        if (rule["bonus_without_attunement"] == JsonPrimitive(true))
                            "Действует и без настройки"
                        else "После настройки на предмет"
                    else null,
                    if (d["level"].number(1) > 1) "с уровня ${d["level"].number()}" else null,
                )
                .joinToString(" · "),
            if (kind == "weapon") Glyph.Swords else Glyph.ShieldCheck,
            true,
        )
    if (kind == "weapon") {
        if (rule["damage_type"] != null)
            fact(
                "Тип основного урона",
                metadata.suggest(rule["damage_type"].referenceId() ?: 0, 12)?.value
                    ?: "Название недоступно",
                "Заменяет тип урона основы",
                Glyph.Swords,
            )
        if (rule["extra_tags"].arrayValue().isNotEmpty())
            fact("Дополнительные свойства", names(14, rule["extra_tags"]), glyph = Glyph.Tags)
        if (rule["extra_proficiencies"].arrayValue().isNotEmpty())
            fact(
                "Также подходит владение",
                names(4, rule["extra_proficiencies"]),
                glyph = Glyph.Badge,
            )
        if (rule["range_min"] != null || rule["range_max"] != null)
            fact(
                "Дистанция",
                listOf(rule.text("range_min"), rule.text("range_max"))
                    .filter(String::isNotBlank)
                    .joinToString(" / ") + " фт.",
                "Вместо значения основы",
                Glyph.Target,
            )
        if (d["weapon_bonus_transfer"] is JsonObject) {
            val transfer = d["weapon_bonus_transfer"].objectValue()
            fact(
                transfer.text("title").ifBlank { "Перенести в защиту" },
                "0–$bonus к КД",
                listOf(
                        transfer.text("condition"),
                        "Столько же вычитается из бонуса атаки и урона. Сброс вручную под оружием.",
                    )
                    .filter(String::isNotBlank)
                    .joinToString(" "),
                Glyph.ShieldCheck,
            )
        }
        d["weapon_damage"].arrayValue().forEach { raw ->
            val action = raw.objectValue()
            val count =
                weaponDamageDiceCount(
                    action,
                    maxOf(1, action["level"].number(1), d["level"].number(1)),
                )
            val display = JsonObject(action + ("dice_count" to JsonPrimitive(count)))
            val parent =
                d["weapon_damage"]
                    .arrayValue()
                    .map { it.objectValue() }
                    .firstOrNull { it.text("key") == action.text("requires_damage_key") }
            val resource =
                d["use_resources"]
                    .arrayValue()
                    .map { it.objectValue() }
                    .firstOrNull { it.text("key") == action.text("resource_key") }
            val facts =
                listOfNotNull(
                    action.text("condition").takeIf(String::isNotBlank)
                        ?: if (action.text("attack_mode") == "thrown") "При броске оружия"
                        else "При выполнении условий свойства",
                    if (action["resource_units_max"].number() > 0)
                        "За одну ячейку; выбор от 0 до ${action["resource_units_max"].number()}"
                    else null,
                    if (
                        action["uses_resource"] == JsonPrimitive(true) ||
                            action.text("resource_key").isNotBlank()
                    )
                        "Расход: ${action["resource_cost"].number(1)} — ${resource?.text("title") ?: "заряды предмета"}"
                    else null,
                    parent?.let { "Вместе с «${it.text("label") }»" },
                    if (action["once_per_turn"] == JsonPrimitive(true)) "Не чаще раза за ход"
                    else null,
                    if (action["double_on_critical"] != JsonPrimitive(false))
                        "Кости удваиваются при крите"
                    else null,
                    if (d.text("attunement") != "none") "После настройки" else null,
                    if (action["dice_count_level_divisor"] != null) "Количество растёт с уровнем"
                    else null,
                    maxOf(d["level"].number(1), action["level"].number(1))
                        .takeIf { it > 1 }
                        ?.let { "С уровня $it" },
                )
            cards += {
                EquipmentFact(
                    action.text("label").ifBlank { "Дополнительный урон" },
                    "",
                    facts.joinToString(" · "),
                    Glyph.Dice,
                ) {
                    EquipmentDamage(display, metadata)
                }
            }
        }
    } else {
        if (rule["ignore_strength"] == JsonPrimitive(true))
            fact(
                "Требование Силы",
                "Без ограничения",
                "Отменяет требование основы",
                Glyph.ShieldCheck,
            )
        if (rule["ignore_stealth_disadvantage"] == JsonPrimitive(true))
            fact("Скрытность", "Без помехи от доспеха")
        if (rule["grants_proficiency"] == JsonPrimitive(true))
            fact("Владение доспехом", "Предоставляется владельцу", glyph = Glyph.Badge)
    }
    if (d["last_charge"] is JsonObject) {
        val check = d["last_charge"].objectValue()
        fact(
            "При последнем заряде",
            "${check.text("dice").replace('d', 'к')}: на 1${if (check["failure_max"].number() > 1) "–${check["failure_max"].number()}" else ""}",
            "Предмет теряет магические свойства; остаётся выбранная основа",
            Glyph.Dice,
        )
    }
    if (cards.isNotEmpty())
        EquipmentSection(
            if (kind == "weapon") "Что добавляется к оружию" else "Что меняется у доспеха",
            Glyph.Wand,
            WebPalette.Danger,
        ) {
            EquipmentGrid(cards)
        }
}

package ru.dndshare.client.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun EquipmentMechanicsContent(
    item: CatalogueItem,
    metadata: HandbookMetadata,
    open: (Long) -> Unit,
) {
    val d = item.data
    d["weapon_notes"].arrayValue().forEach { raw ->
        val note = raw.objectValue()
        val kind = note.text("kind")
        EquipmentMechanicPanel(
            note.text("title"),
            when (kind) {
                "curse" -> "Проклятие"
                "weapon_use" -> "Особое применение"
                else -> "Свойство"
            },
            if (kind == "weapon_use") Glyph.Swords else Glyph.Wand,
            danger = kind == "curse",
        ) {
            RichDescription(note.text("description"), openItem = open)
            EquipmentTheses(
                note["requirements"].arrayValue().mapNotNull {
                    (it as? JsonPrimitive)?.contentOrNull
                }
            )
        }
    }
    d["confirmed_uses"].arrayValue().forEach { raw ->
        val use = raw.objectValue()
        EquipmentSection(use.text("title"), Glyph.CircleCheck) {
            RichDescription(use.text("description"), openItem = open)
            EquipmentTheses(
                use["requirements"].arrayValue().mapNotNull {
                    (it as? JsonPrimitive)?.contentOrNull
                }
            )
            val labels =
                listOf(
                    use.text("confirm_label"),
                    "Расход: ${use["resource_cost"].number()} заряд(ов)",
                    if (use["cooldown_dawns"].number() > 0)
                        "Ожидание: ${use["cooldown_dawns"].number()} рассвет(ов)"
                    else "",
                    if (use.text("activation") == "carried") "Предмет при персонаже"
                    else if (use.text("activation").isNotBlank()) "Предмет экипирован" else "",
                )
            Text(
                labels.filter(String::isNotBlank).joinToString(" · "),
                style = ShareTypography.context,
                color = WebPalette.TextSecondary,
            )
        }
    }
    val target = d["selected_target"] as? JsonObject
    if (target != null)
        EquipmentSection(
            target.text("title").ifBlank { "Выбранная цель" },
            Glyph.Target,
            WebPalette.Danger,
        ) {
            if (target.text("condition").isNotBlank())
                Text(target.text("condition"), color = WebPalette.TextSecondary)
            val cards = mutableListOf<@Composable () -> Unit>()
            if (target["damage"] is JsonObject)
                cards += {
                    EquipmentFact("Дополнительный урон по цели", "", icon = Glyph.Dice) {
                        EquipmentDamage(target["damage"].objectValue(), metadata)
                    }
                }
            listOf(
                    "attack_advantage" to "Преимущество против выбранной цели",
                    "ranged_only" to "Бонусы по цели — только для дальних атак",
                    "other_weapons_disadvantage" to "Пока цель жива — помеха атакам другим оружием",
                    "ignore_partial_cover" to "Игнорирует укрытие, кроме полного",
                    "ignore_long_range" to "Без помехи от дальней дистанции",
                )
                .forEach { (key, text) ->
                    if (target[key] == JsonPrimitive(true))
                        cards += { EquipmentFact("Выбранная цель", text, icon = Glyph.Target) }
                }
            cards += {
                EquipmentFact(
                    "Срок",
                    "${target["duration_dawns"].number()} рассветов",
                    "После гибели: ожидание ${target["cooldown_dawns"].number()} рассветов",
                    Glyph.Clock,
                )
            }
            EquipmentGrid(cards)
        }
    val uses = d["weapon_uses"].arrayValue()
    if (uses.isNotEmpty())
        EquipmentSection("Особое применение оружия", Glyph.Swords, WebPalette.Danger) {
            uses.forEach { raw ->
                val use = raw.objectValue()
                EquipmentMechanicPanel(use.text("title"), "Особое применение", Glyph.Swords) {
                    val resource =
                        d["use_resources"]
                            .arrayValue()
                            .map { it.objectValue() }
                            .firstOrNull { it.text("key") == use.text("resource_key") }
                            ?.text("title") ?: "заряды предмета"
                    Text(
                        (if (use.text("attack_mode") == "melee") "Рукопашная атака"
                        else "Дистанция до ${use["range_ft"].number()} футов") +
                            if (use["resource_cost"].number() > 0)
                                " · Расход при первом броске применения: ${use["resource_cost"].number()} ($resource)"
                            else "",
                        style = ShareTypography.context,
                        color = WebPalette.TextSecondary,
                    )
                    use["steps"].arrayValue().forEach { stepRaw ->
                        val step = stepRaw.objectValue()
                        ShareTile(framed = false, contentPadding = PaddingValues(10.dp)) {
                            Text(step.text("title"), style = ShareTypography.group)
                            if (step.text("kind") == "weapon_damage")
                                Text("Урон оружия +", style = ShareTypography.context)
                            EquipmentDamage(step, metadata)
                            EquipmentTheses(
                                equipmentUseRequirements(step, use["range_ft"].number())
                            )
                        }
                    }
                }
            }
        }
    if (d["status_effects"].arrayValue().isNotEmpty())
        EquipmentSection("Накладываемые эффекты", Glyph.Wand) {
            d["status_effects"].arrayValue().forEach { raw ->
                val effect = raw.objectValue()
                (effect["effect_id"] ?: effect["item_id"]).referenceId()?.let {
                    EquipmentReference(it, metadata, open)
                }
                if (effect.text("condition").isNotBlank())
                    Text(effect.text("condition"), style = ShareTypography.context)
            }
        }
    val treasure = d["treasure"] as? JsonObject
    if (
        treasure != null &&
            selectedEquipmentBases(item, LocalCataloguePreview.current.instance).isEmpty()
    )
        EquipmentSection("Генератор сокровищ", Glyph.Gem) {
            ShareTile(framed = false, tint = WebPalette.Warning) {
                Text("Участвует в случайном подборе", color = WebPalette.Warning)
                EquipmentGrid(
                    listOf(
                        {
                            EquipmentFact(
                                "Уровень группы",
                                "${treasure.text("min_level")}–${treasure.text("max_level")}",
                                "В этом диапазоне предмет может выпасть",
                                Glyph.Characters,
                                true,
                            )
                        },
                        {
                            EquipmentFact(
                                "Вес выпадения",
                                treasure.text("weight"),
                                "Больше вес — чаще выпадает",
                                Glyph.Weight,
                                true,
                            )
                        },
                    )
                )
            }
        }
}

@Composable
private fun EquipmentMechanicPanel(
    title: String,
    label: String,
    icon: Glyph,
    danger: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    val tone = if (danger) WebPalette.Danger else WebPalette.AccentSoft
    ShareTile(framed = false, tint = tone, contentPadding = PaddingValues(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            AppGlyph(icon, tint = tone)
            Column {
                Text(label, style = ShareTypography.context, color = tone)
                Text(title, style = ShareTypography.group)
            }
        }
        content()
    }
}

internal fun equipmentUseRequirements(step: JsonObject, range: Int): List<String> = buildList {
    addAll(step["requirements"].arrayValue().mapNotNull { (it as? JsonPrimitive)?.contentOrNull })
    val area = step["area"] as? JsonObject
    if (area != null) add("Линия до $range × ${area["width_ft"].number()} футов")
    val save = step["save"] as? JsonObject
    if (save != null)
        add(
            "Спасбросок: ${listOf("", "Сила", "Ловкость", "Телосложение", "Интеллект", "Мудрость", "Харизма").getOrElse(save["ability"].number()) { "—" }} · Сл ${save["dc"].number()}${if (save["half"] == JsonPrimitive(true)) " · половина урона при успехе" else ""}"
        )
}

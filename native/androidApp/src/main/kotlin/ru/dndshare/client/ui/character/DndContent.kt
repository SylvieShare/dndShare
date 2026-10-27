package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.designsystem.*

@Composable
internal fun DndWeapons() {
    val context = LocalCharacterSheet.current
    val equipment = context.sheet.values["weapon"].arrayValue() + context.sheet.values["items"].objectValue()["equipped"].arrayValue()
    val weapons = equipment.filter { entry ->
        val item = context.items[(entry.objectValue()["magic_item_id"] ?: entry.objectValue()["item_id"]).referenceId()]
        item?.typeId == 1L || item?.typeId == 19L && item.data["weapon"] is JsonObject
    }
    if (weapons.isEmpty()) SheetEmpty("Нет экипированного оружия")
    else weapons.forEach { SheetCatalogueEntry(it) }
}

@Composable
internal fun DndSpells() {
    val context = LocalCharacterSheet.current
    val spells = context.sheet.values["spells"].objectValue()
    val tabs = spells["tabs"].arrayValue()
    val grants = spells["grants"].arrayValue()
    if (tabs.isEmpty() && grants.isEmpty()) SheetEmpty("Книга заклинаний пока пуста")
    for ((key, label) in listOf("long_rest" to "Ячейки заклинаний", "short_rest" to "Магия договора")) {
        val slots = spells["slot_pools"].objectValue()[key].arrayValue().map { it.objectValue() }.filter { it["total"].number() > 0 }
        if (slots.isNotEmpty()) ShareTile {
            Text(label, style = ShareTypography.group)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                slots.forEach { slot -> ShareBadge("${slot["level"].number()} · ${maxOf(0, slot["total"].number() - slot["used"].number())}/${slot["total"].number()}") }
            }
        }
    }
    tabs.forEach { raw ->
        val tab = raw.objectValue()
        ShareSection(tab.text("name").ifBlank { "Заклинания" }) {
            val rawAbility = tab.text("casting_ability")
            val key = Regex("STR|DEX|CON|INT|WIS|CHA").find(rawAbility)?.value
                ?: rawAbility.toIntOrNull()?.takeIf { it in 1..6 }?.let { listOf("STR", "DEX", "CON", "INT", "WIS", "CHA")[it - 1] }
            if (key != null) {
                val modifier = abilityModifier(context.mechanics.score(key))
                ShareStats(listOf(ShareStat("СЛ спасброска", (8 + modifier + context.sheet.proficiency() + tab["save_bonus"].number()).toString()),
                    ShareStat("Атака", signed(modifier + context.sheet.proficiency() + tab["attack_bonus"].number()))))
            }
            val entries = tab["spells"].arrayValue()
            if (entries.isEmpty()) SheetEmpty("Нет заклинаний")
            entries.forEach { SheetCatalogueEntry(it, expanded = false) }
        }
    }
    if (grants.isNotEmpty()) ShareSection("Дарованные заклинания") { grants.forEach { SheetCatalogueEntry(it, expanded = false) } }
}

@Composable
internal fun DndInventory() {
    val context = LocalCharacterSheet.current
    val items = context.sheet.values["items"].objectValue()
    ShareSection("Экипировка") {
        val equipped = items["equipped"].arrayValue()
        if (equipped.isEmpty()) SheetEmpty("Нет экипированных предметов")
        equipped.forEach { SheetCatalogueEntry(it, expanded = false) }
    }
    items["sections"].arrayValue().forEach { raw ->
        val section = raw.objectValue()
        ShareSection(section.text("name").ifBlank { "Хранилище" }) {
            val entries = section["items"].arrayValue()
            if (entries.isEmpty()) SheetEmpty("Пусто")
            entries.forEach { SheetCatalogueEntry(it, expanded = false) }
        }
    }
    val money = context.sheet.values["money"].objectValue()
    ShareTile {
        Text("Кошелёк", style = ShareTypography.card)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            money["order"].arrayValue().forEach { currency ->
                val id = currency.jsonPrimitive.content
                val title = context.metadata.suggests["17"]?.firstOrNull { it.id.toString() == id }?.value ?: "Монеты"
                Text("${money["amounts"].objectValue()[id].number()} $title", style = ShareTypography.group)
            }
        }
    }
}

@Composable
internal fun DndAbilities(format: LayoutFormat) {
    if (format != LayoutFormat.Wide) DndFeatureSummary()
    val values = LocalCharacterSheet.current.sheet.values
    val groups = listOf("abilities_class" to "Классовые способности", "abilities_race" to "Расовые способности",
        "abilities_story" to "Предыстория", "abilities_feats" to "Черты")
    groups.forEach { (key, label) ->
        ShareSection(label) {
            val entries = values[key].arrayValue()
            if (entries.isEmpty()) SheetEmpty("Нет записей")
            entries.forEach { SheetCatalogueEntry(it) }
        }
    }
}

@Composable
internal fun DndFeatureSummary() {
    val context = LocalCharacterSheet.current
    val values = context.sheet.values
    val resources = remember(context.sheet.data, context.items) { sheetResources(context.sheet, context.items) }
    val actions = remember(context.sheet.data, context.items) { sheetActions(context.sheet, context.items) }
    val defenses = remember(context.sheet.data, context.items) { sheetDefenses(context.sheet, context.items) }
    if (actions.isNotEmpty()) ShareTile {
        Text("Действия", style = ShareTypography.card)
        actions.forEach { Text(it.title, style = ShareTypography.group); SheetDescription(it.description) }
    }
    if (resources.isNotEmpty()) ShareTile {
        Text("Ресурсы", style = ShareTypography.card)
        resources.forEach { row -> Row(Modifier.fillMaxWidth()) {
            Text(row.title, Modifier.weight(1f), style = ShareTypography.group)
            Text("${row.available}/${row.total}", color = WebPalette.AccentSoft, style = ShareTypography.group)
        } }
    }
    if (defenses.isNotEmpty()) ShareTile {
        Text("Защиты", style = ShareTypography.card)
        defenses.forEach { row ->
            val kind = when (row.text("kind")) { "immunity" -> "Невосприимчивость"; "vulnerability" -> "Уязвимость"; else -> "Сопротивление" }
            val name = context.metadata.suggests["12"]?.firstOrNull { it.id == row["damage_type"].referenceId() }?.value.orEmpty()
            Text("$kind · $name", style = ShareTypography.group)
        }
    }
    val groups = values["proficiencies"].objectValue().filterValues { it.arrayValue().isNotEmpty() }
    if (groups.isNotEmpty()) ShareTile {
        Text("Владения", style = ShareTypography.card)
        groups.forEach { (label, entries) ->
            Text(label, style = ShareTypography.group)
            Text(entries.arrayValue().joinToString(" · ") { it.objectValue().label().ifBlank { (it as? JsonPrimitive)?.content.orEmpty() } }, style = ShareTypography.context)
        }
    }
}

@Composable
internal fun DndPersonality() {
    val values = LocalCharacterSheet.current.sheet.values
    val groups = listOf("Основное" to listOf("person_origin" to "Предыстория", "person_alignment" to "Мировоззрение", "person_appearance" to "Внешность"),
        "Облик" to listOf("person_height" to "Рост", "person_weight" to "Вес", "person_age" to "Возраст", "person_eyes" to "Глаза", "person_skin" to "Кожа", "person_hair" to "Волосы"),
        "Характер" to listOf("person_traits" to "Черты характера", "person_ideals" to "Идеалы", "person_bonds" to "Привязанности", "person_flaws" to "Слабости"),
        "История" to listOf("person_backstory" to "История", "person_allies" to "Союзники"))
    groups.forEach { (title, fields) ->
        ShareTile {
            Text(title, style = ShareTypography.card)
            fields.forEach { (key, label) ->
                Text(label, style = ShareTypography.context, color = WebPalette.TextMuted)
                val content = values.text(key)
                if (content.isNotBlank()) SheetDescription(content) else Text("—", style = ShareTypography.group)
            }
        }
    }
}

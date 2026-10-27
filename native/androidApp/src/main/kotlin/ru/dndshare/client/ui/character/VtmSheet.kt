package ru.dndshare.client.ui.character

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.designsystem.*

private val physical = listOf("strength" to "Сила", "dexterity" to "Ловкость", "stamina" to "Выносливость")
private val social = listOf("charisma" to "Обаяние", "manipulation" to "Манипуляция", "appearance" to "Внешность")
private val mental = listOf("perception" to "Восприятие", "intelligence" to "Интеллект", "wits" to "Смекалка")
private val talents = listOf("athletics" to "Атлетика", "alertness" to "Бдительность", "brawl" to "Драка", "intimidation" to "Запугивание", "expression" to "Красноречие", "leadership" to "Лидерство", "streetwise" to "Уличное чутьё", "subterfuge" to "Хитрость", "dodge" to "Шестое чувство", "empathy" to "Эмпатия")
private val skills = listOf("drive" to "Вождение", "security" to "Воровство", "survival" to "Выживание", "performance" to "Исполнение", "animal_ken" to "Обращение с животными", "crafts" to "Ремесло", "stealth" to "Скрытность", "firearms" to "Стрельба", "melee" to "Фехтование", "etiquette" to "Этикет")
private val knowledge = listOf("linguistics" to "Гуманитарные науки", "academics" to "Естественные науки", "law" to "Законы", "computer" to "Информатика", "medicine" to "Медицина", "occult" to "Оккультизм", "politics" to "Политика", "investigation" to "Расследование", "finance" to "Финансы", "electronics" to "Электроника")

@Composable
internal fun VtmSheetSection(section: SheetSection, format: LayoutFormat) {
    val context = LocalCharacterSheet.current
    when (section) {
        SheetSection.Base -> {
            if (format == LayoutFormat.Wide) Row(horizontalArrangement = Arrangement.spacedBy(21.dp)) {
                Column(Modifier.width(DesignTokens.Layout.SheetStatsColumn), verticalArrangement = Arrangement.spacedBy(16.dp)) { VtmIdentity() }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(20.dp)) { VtmStats(); VtmAbilities(); VtmAdvantages() }
            } else VtmIdentity()
        }
        SheetSection.Stats -> VtmStats()
        SheetSection.Abilities -> VtmAbilities()
        SheetSection.Advantages -> VtmAdvantages()
        SheetSection.Personality -> ShareTile { Text("Слабость клана", style = ShareTypography.card); SheetDescription(context.sheet.values.text("clan_weakness")) }
        SheetSection.Journal -> ShareTile { Text("Заметки", style = ShareTypography.card); SheetDescription(context.sheet.values.text("notes")) }
        else -> Unit
    }
}

@Composable
private fun VtmIdentity() {
    val context = LocalCharacterSheet.current
    val values = context.sheet.values
    ShareTile {
        Text(context.sheet.name, style = ShareTypography.card)
        context.sheet.portrait?.let { AsyncImage(it, null, imageLoader = context.images, modifier = Modifier.fillMaxWidth().height(240.dp)) }
        listOf("clan" to "Клан", "nature" to "Натура", "mask" to "Маска", "persona" to "Амплуа", "sire" to "Сир").forEach { (key, title) ->
            Row(Modifier.fillMaxWidth()) { Text(title, Modifier.weight(1f), style = ShareTypography.context, color = WebPalette.TextMuted); Text(values.text(key), style = ShareTypography.group) }
        }
    }
    ShareTile {
        Text("Здоровье", style = ShareTypography.card)
        val damage = values["health"].arrayValue()
        listOf("Царапина", "Травма", "Ранение", "Тяжёлое ранение", "Изуродован", "Искалечен", "Недееспособен").forEachIndexed { index, label ->
            val kind = (damage.getOrNull(index) as? JsonPrimitive)?.content.orEmpty()
            Row(Modifier.fillMaxWidth()) {
                Text(label, Modifier.weight(1f), style = ShareTypography.group)
                Text(when (kind) { "bashing" -> "/"; "lethal" -> "X"; "aggravated" -> "*"; else -> "□" }, color = WebPalette.Danger)
            }
        }
        val blood = values["blood_pool"].objectValue()
        Text("Запас крови: ${blood["current"].number()} / ${blood["max"].number(10)}", style = ShareTypography.group)
        Text("Опыт: ${values["xp_total"].number()} · потрачено ${values["xp_spent"].number()}", style = ShareTypography.context)
    }
}

@Composable
private fun VtmStats() {
    ShareBalancedColumns {
        VtmPointGroup("Физические", physical)
        VtmPointGroup("Социальные", social)
        VtmPointGroup("Ментальные", mental)
    }
}

@Composable
private fun VtmAbilities() {
    ShareBalancedColumns { VtmPointGroup("Таланты", talents); VtmPointGroup("Навыки", skills); VtmPointGroup("Знания", knowledge) }
}

@Composable
private fun VtmAdvantages() {
    val values = LocalCharacterSheet.current.sheet.values
    listOf("disciplines" to "Дисциплины", "backgrounds" to "Предыстории").forEach { (key, title) ->
        ShareTile {
            Text(title, style = ShareTypography.card)
            values[key].arrayValue().forEach { raw ->
                val entry = raw.objectValue()
                Text("${entry.label()} ${"●".repeat(entry["value"].number().coerceIn(0, 20))}", style = ShareTypography.group)
            }
        }
    }
    VtmPointGroup("Добродетели", listOf("conscience" to "Совесть / Решимость", "self_control" to "Самоконтроль / Инстинкты", "courage" to "Смелость"))
    VtmPointGroup("Человечность и сила воли", listOf("humanity" to "Человечность", "willpower_perm" to "Постоянная", "willpower_temp" to "Временная"), maximum = 10)
}

@Composable
private fun VtmPointGroup(title: String, fields: List<Pair<String, String>>, maximum: Int = 5) {
    val context = LocalCharacterSheet.current
    ShareTile {
        Text(title, style = ShareTypography.card)
        fields.forEach { (key, label) ->
            val value = context.sheet.values[key].number().coerceIn(0, maximum)
            Row(Modifier.fillMaxWidth().heightIn(min = 36.dp).clickable(enabled = context.canEdit) { context.edit("vtm:$key:$label") },
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(label, Modifier.weight(1f), style = ShareTypography.group)
                Text("●".repeat(value) + "○".repeat(maximum - value), style = ShareTypography.group, color = WebPalette.AccentSoft)
            }
        }
    }
}

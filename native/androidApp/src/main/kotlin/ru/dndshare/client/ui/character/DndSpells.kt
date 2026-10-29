package ru.dndshare.client.ui.character

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun DndSpells() {
    val context = LocalCharacterSheet.current
    val book = context.sheet.values["spells"].objectValue()
    val tabs = book["tabs"].arrayValue().map { it.objectValue() }
    var selected by rememberSaveable(context.uuid) { mutableStateOf("") }
    val tab = tabs.firstOrNull { it.text("key") == selected } ?: tabs.firstOrNull()
    ShareTile(
        framed = false,
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
    ) {
        Text(
            if (context.sheet.sourceVersion == "2024")
                "В каждый ход можно потратить на сотворение заклинаний только одну ячейку. Сотворения без ячейки не расходуют этот лимит."
            else
                "После заклинания бонусным действием в этот ход можно сотворить только заговор со временем накладывания 1 действие.",
            style =
                ShareTypography.context.copy(
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Normal,
                ),
            color = WebPalette.TextMuted,
        )
    }
    context.concentration?.let { held ->
        ShareTile(framed = false) {
            Text(
                "Концентрация: ${held.text("name").ifBlank {"Заклинание"}}",
                style = ShareTypography.group,
            )
            if (context.canEdit)
                ShareTextButton(onClick = { context.edit("concentration-end") }) {
                    Text("Завершить концентрацию")
                }
        }
    }
    if (spellCastingBlocked(context.sheet, context.items, context.metadata))
        Text(
            "Сотворение заклинаний недоступно: активный эффект или отсутствие владения экипированным доспехом.",
            color = WebPalette.Warning,
            style = ShareTypography.context,
        )
    SpellSlotPanels()
    val grants = book["grants"].arrayValue()
    if (grants.isNotEmpty()) ShareSection("Дарованные заклинания") { SpellGroups(grants, null) }
    SpellSourceTabs(tabs, tab?.text("key"), { selected = it })
    if (tab == null) SheetEmpty("Создайте книгу магии, чтобы добавлять заклинания.")
    else
        AnimatedContent(tab.text("key"), label = "Spell book") { key ->
            val source = tabs.firstOrNull { it.text("key") == key }
            if (source != null)
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SpellBookStats(source)
                    if (context.canEdit && source["spells"].arrayValue().size > 1)
                        ShareTextButton(
                            onClick = { context.edit("reorder:spells|${source.text("key")}") }
                        ) {
                            Text("Изменить порядок")
                        }
                    val entries = source["spells"].arrayValue()
                    if (
                        source.text("mode") in setOf("prepared", "spellbook") &&
                            entries.isNotEmpty()
                    ) {
                        val count = preparedSpellCount(entries, context.items)
                        val limit =
                            spellBookRules(context.sheet, source, context.items)?.preparedLimit
                        SpellPreparationSummary(count, limit, entries)
                    }
                    if (entries.isEmpty()) SheetEmpty("Нет заклинаний")
                    else SpellGroups(entries, source)
                    if (context.canEdit) {
                        spellBookRules(context.sheet, source, context.items)?.let { rules ->
                            val known =
                                (entries +
                                        grants.filter {
                                            it.objectValue()["counts_as_known"] ==
                                                JsonPrimitive(true) &&
                                                it.objectValue().text("tab_key") ==
                                                    source.text("key")
                                        })
                                    .mapNotNull { context.items[it.referenceId()] }
                            val counts = buildList {
                                if (rules.casting.progression)
                                    rules.casting.cantrips?.let {
                                        add(
                                            "Заговоры ${known.count {it.data["lvl"].number()==0}} / $it"
                                        )
                                    }
                                if (rules.casting.mode == "known" && rules.casting.progression)
                                    rules.casting.spells?.let {
                                        add(
                                            "Заклинания ${known.count {it.data["lvl"].number()>0}} / $it"
                                        )
                                    }
                                add("Доступно до ${rules.maximumCircle} круга")
                            }
                            Text(
                                counts.joinToString(" · "),
                                style = ShareTypography.context,
                                color = WebPalette.TextMuted,
                            )
                        }
                        ShareAddAction(
                            "+ Найти заклинание…",
                            { context.edit("spell:${source.text("key")}|new") },
                        )
                    }
                }
        }
}

@Composable
private fun SpellGroups(entries: List<JsonElement>, tab: JsonObject?) {
    val context = LocalCharacterSheet.current
    entries
        .groupBy { context.items[it.referenceId()]?.data?.get("lvl").number(-1) }
        .toSortedMap()
        .forEach { (level, rows) ->
            ShareTile(
                Modifier.fillMaxWidth(),
                framed = false,
                contentPadding = PaddingValues(14.dp),
            ) {
                Row(
                    verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Text(
                        when (level) {
                            0 -> "ЗАГОВОРЫ · НЕОГР."
                            -1 -> "БЕЗ УРОВНЯ"
                            else -> "$level КРУГ"
                        },
                        style =
                            ShareTypography.context.copy(
                                fontSize = 12.sp,
                                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                                letterSpacing = .6.sp,
                            ),
                        color = WebPalette.TextMuted,
                    )
                    HorizontalDivider(Modifier.weight(1f), color = WebPalette.BorderStrong)
                }
                rows.forEach { entry ->
                    key(entry.objectValue().text("key")) { SpellCatalogueCard(entry, tab) }
                }
            }
        }
}

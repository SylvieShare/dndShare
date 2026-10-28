package ru.dndshare.client.ui.character

import ru.dndshare.client.ui.LayoutFormat

enum class SheetSection(val title: String, val asset: String) {
    Base("База", "tab-personality.svg"),
    Stats("Статы", "tab-stats.svg"),
    Weapons("Оружие", "tab-weapons.svg"),
    Spells("Магия", "tab-magic.svg"),
    Inventory("Предметы", "container-box.svg"),
    Abilities("Способности", "tab-skills.svg"),
    Advantages("Преимущества", "tab-magic.svg"),
    Personality("Личность", "tab-personality.svg"),
    Journal("Дневник", "edit-note.svg"),
}

fun sheetSections(template: String, format: LayoutFormat): List<SheetSection> =
    if (template == "VTM20") {
        if (format == LayoutFormat.Wide)
            listOf(SheetSection.Base, SheetSection.Personality, SheetSection.Journal)
        else
            listOf(
                SheetSection.Base,
                SheetSection.Stats,
                SheetSection.Abilities,
                SheetSection.Advantages,
                SheetSection.Personality,
                SheetSection.Journal,
            )
    } else {
        val content =
            listOf(
                SheetSection.Weapons,
                SheetSection.Spells,
                SheetSection.Inventory,
                SheetSection.Abilities,
                SheetSection.Personality,
                SheetSection.Journal,
            )
        when (format) {
            LayoutFormat.Phone -> listOf(SheetSection.Base, SheetSection.Stats) + content
            LayoutFormat.Wide ->
                listOf(content[0], content[1], content[3], content[2], content[4], content[5])
            else -> listOf(SheetSection.Base, SheetSection.Stats) + content
        }
    }

data class DndAbility(
    val id: String,
    val title: String,
    val suggestId: Long,
    val skills: List<Long>,
)

val dndAbilities =
    listOf(
        DndAbility("STR", "Сила", 1, listOf(1)),
        DndAbility("DEX", "Ловкость", 2, listOf(2, 3, 4)),
        DndAbility("CON", "Телосложение", 3, emptyList()),
        DndAbility("INT", "Интеллект", 4, listOf(5, 6, 7, 8, 9)),
        DndAbility("WIS", "Мудрость", 5, listOf(10, 11, 12, 13, 14)),
        DndAbility("CHA", "Харизма", 6, listOf(15, 16, 17, 18)),
    )

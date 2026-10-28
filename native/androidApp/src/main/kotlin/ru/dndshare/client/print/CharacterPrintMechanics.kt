package ru.dndshare.client.print

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.character.creation.skillStat
import ru.dndshare.client.model.*

internal fun printSkillRows(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): List<Pair<String, String>> = buildList {
    val mechanics = DndDerivedValues(sheet, items, metadata)
    val titles = metadata.suggests["15"].orEmpty().associateBy { it.id.toString() }
    for ((ability, stat) in listOf("STR", "DEX", "CON", "INT", "WIS", "CHA").withIndex()) {
        val owned = sheet.values[stat].objectValue()["skills"].objectValue()
        val keys =
            (titles.keys.filter { skillStat(it.toLongOrNull() ?: 0) == stat } + owned.keys)
                .distinct()
        for (key in keys) {
            val row = owned[key].objectValue()
            val rule =
                RuleContext(
                    kind = "skill_check",
                    ability = ability + 1L,
                    skill = key.toLongOrNull(),
                )
            val rank = maxOf(row["up"].number(), mechanics.rank("skill_proficiency", rule))
            val total =
                abilityModifier(mechanics.score(stat)) +
                    rank * sheet.proficiency() +
                    row["bonuses"].bonusTotal() +
                    mechanics.bonus("skill_bonus", rule.copy(proficient = rank > 0))
            add(
                row.text("override_title").ifBlank { titles[key]?.value ?: "Свой навык" } to
                    signed(total)
            )
        }
    }
}

internal fun printChoiceLabels(
    entry: JsonObject,
    item: CatalogueItem?,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): List<Pair<String, String>> {
    val selections = entry["choices"].objectValue()
    val definitions = item?.data?.get("choices").arrayValue().map { it.objectValue() }
    return selections.map { (key, selected) ->
        val definition = definitions.firstOrNull { it.text("key") == key }
        val options =
            definition
                ?.let { characterChoiceOptions(it, selections, items, metadata).toMap() }
                .orEmpty()
        (definition?.text("label")?.takeIf(String::isNotBlank) ?: key) to
            selected.arrayValue().joinToString(", ") { value ->
                val raw = (value as? JsonPrimitive)?.content ?: value.objectValue().label()
                options[raw]
                    ?: items[raw.toLongOrNull()]?.name
                    ?: raw.takeUnless { it.toLongOrNull() != null }
                    ?: "Запись недоступна"
            }
    }
}

internal fun printWeaponBlocks(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): List<CharacterPrintBlock> = buildList {
    val entries = sheet.values["weapon"].arrayValue().map { it.objectValue() }
    if (entries.isEmpty()) return@buildList
    add(CharacterPrintBlock("Оружие"))
    for (entry in entries) {
        val readout = weaponReadout(sheet, entry, items, metadata)
        val custom = entry["override"].objectValue()
        val item = readout?.item ?: resolveWeapon(entry, items)
        val name = custom.text("name").ifBlank { item?.name ?: "Своя атака" }
        val rows = buildList {
            if (readout != null) {
                add("Атака" to signed(readout.attack))
                add("Урон" to readout.expression())
                if (readout.parts.any { it.type.isNotBlank() })
                    add(
                        "Тип урона" to
                            readout.parts
                                .map { it.type }
                                .filter(String::isNotBlank)
                                .distinct()
                                .joinToString(", ")
                    )
                if (readout.twoHanded.isNotEmpty())
                    add("Двумя руками" to readout.expression(versatile = true))
                if (readout.range.isNotBlank()) add("Дистанция" to readout.range)
                if (readout.properties.isNotEmpty())
                    add("Свойства" to readout.properties.joinToString(", "))
                if (readout.criticalThreshold != 20)
                    add("Критическое попадание" to "${readout.criticalThreshold}–20")
            }
        }
        add(
            CharacterPrintBlock(
                name,
                custom.text("desc").ifBlank {
                    entry.text("desc").ifBlank { item?.data?.text("desc").orEmpty() }
                },
                rows,
            )
        )
    }
}

internal fun printSpellBlocks(
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata,
): List<CharacterPrintBlock> = buildList {
    val book = sheet.values["spells"].objectValue()
    val mechanics = DndDerivedValues(sheet, items, metadata)
    fun emitReference(raw: JsonElement, source: String) {
        val entry = raw.objectValue()
        val item = items[entry.referenceId()]
        val readout = runCatching {
            spellReadout(sheet, entry.text("key"), items, metadata)
        }
            .getOrNull()
        val rows = buildList {
            if (source.isNotBlank()) add("Источник" to source)
            item?.let {
                add(
                    "Круг" to
                        if (it.data["lvl"].number() == 0) "Заговор"
                        else it.data["lvl"].number().toString()
                )
            }
            if (entry["prepared"] == JsonPrimitive(true)) add("Подготовка" to "Подготовлено")
            if (readout != null) {
                add("Атака заклинанием" to signed(readout.attack))
                add("Сложность спасброска" to readout.save.toString())
                if (entry["slotless"] == JsonPrimitive(true)) add("Ячейка" to "Не требуется")
                if (entry["cast_level"].number() > 0)
                    add("Круг сотворения" to entry["cast_level"].number().toString())
            }
        }
        add(
            CharacterPrintBlock(
                item?.name ?: "Заклинание недоступно",
                item?.data?.text("desc").orEmpty().ifBlank {
                    item?.data?.text("description").orEmpty()
                },
                rows,
            )
        )
    }
    for (tab in book["tabs"].arrayValue().map { it.objectValue() }) {
        val ability = tab["casting_ability"].referenceId()?.takeIf { it in 1..6 }
        val modifier =
            ability?.let {
                abilityModifier(
                    mechanics.score(
                        listOf("STR", "DEX", "CON", "INT", "WIS", "CHA")[it.toInt() - 1]
                    )
                )
            } ?: 0
        val title = tab.text("name").ifBlank { "Книга заклинаний" }
        add(
            CharacterPrintBlock(
                title,
                values =
                    listOf(
                        "Характеристика" to
                            (metadata.suggests["16"]
                                .orEmpty()
                                .firstOrNull { it.id == ability }
                                ?.value ?: "Без характеристики"),
                        "Атака заклинанием" to
                            signed(modifier + sheet.proficiency() + tab["attack_bonus"].number()),
                        "Сложность спасброска" to
                            (8 + modifier + sheet.proficiency() + tab["save_bonus"].number())
                                .toString(),
                    ),
            )
        )
        tab["spells"].arrayValue().forEach { emitReference(it, title) }
    }
    if (book["grants"].arrayValue().isNotEmpty()) add(CharacterPrintBlock("Дарованные заклинания"))
    book["grants"].arrayValue().forEach { entry ->
        val source = entry.objectValue()["source"].objectValue()
        emitReference(
            entry,
            source.text("label").ifBlank {
                items[source["item_id"].referenceId()]?.name ?: "Дарованное заклинание"
            },
        )
    }
}

package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

data class SpellBookRules(
    val casting: SpellcastingRules,
    val maximumCircle: Int,
    val preparedLimit: Int?,
)

fun spellBookRules(
    sheet: CharacterSheet,
    tab: JsonObject,
    items: Map<Long, CatalogueItem>,
): SpellBookRules? {
    val id = tab["class_item_id"].referenceId() ?: return null
    val entry =
        sheet.values["classes"]
            .arrayValue()
            .map { it.objectValue() }
            .firstOrNull { it.referenceId() == id } ?: return null
    val level = entry["level"].number(1)
    val source =
        listOfNotNull(items[entry["subclass"].referenceId()], items[id]).firstOrNull {
            spellcastingRules(it, level) != null
        } ?: return null
    val casting = spellcastingRules(source, level)!!.let { it.copy(classId = it.classId ?: id) }
    val data = source.data["spellcasting"].objectValue()
    fun progression(key: String) =
        data[key]
            .arrayValue()
            .map { it.objectValue() }
            .filter { it["level"].number() <= level }
            .maxByOrNull { it["level"].number() }
            .objectValue()
    val count = progression("prepared_progression")["count"]?.takeUnless { it == JsonNull }
    val fallback =
        if (data["prepares"] == JsonPrimitive(true) && data.text("selection_mode") == "prepared")
            progression("known_progression")["spells"]?.takeUnless { it == JsonNull }
        else null
    val limit = (count ?: fallback)?.number()?.coerceAtLeast(0)
    val maximum =
        spellSlotPools(listOf(entry), items)
            .values
            .flatMap { it.arrayValue() }
            .maxOfOrNull { it.objectValue()["level"].number() } ?: 0
    return SpellBookRules(casting, maximum, limit)
}

fun spellBookEligibility(
    sheet: CharacterSheet,
    tab: JsonObject,
    item: CatalogueItem,
    items: Map<Long, CatalogueItem>,
    excludedKey: String = "",
): List<String> = buildList {
    val source = spellBookRules(sheet, tab, items) ?: return@buildList
    val rule = source.casting
    val level = item.data["lvl"].number(-1)
    if (level !in 0..source.maximumCircle) add("Круг пока недоступен этому классу.")
    if (
        rule.classId != null &&
            item.data["classes"].arrayValue().none { it.referenceId() == rule.classId }
    )
        add("Не входит в список заклинаний класса.")
    val grants =
        sheet.values["spells"].objectValue()["grants"].arrayValue().filter {
            it.objectValue()["counts_as_known"] == JsonPrimitive(true) &&
                it.objectValue().text("tab_key") == tab.text("key")
        }
    val known =
        (tab["spells"].arrayValue().filter { it.objectValue().text("key") != excludedKey } + grants)
            .mapNotNull { items[it.referenceId()] }
    if (
        rule.progression &&
            level == 0 &&
            rule.cantrips != null &&
            known.count { it.data["lvl"].number() == 0 } >= rule.cantrips
    )
        add("Лимит известных заговоров уже заполнен.")
    if (
        rule.mode == "known" &&
            rule.progression &&
            level > 0 &&
            rule.spells != null &&
            known.count { it.data["lvl"].number() > 0 } >= rule.spells
    )
        add("Лимит известных заклинаний уже заполнен.")
    if (
        level > 0 &&
            rule.allowedSchools.isNotEmpty() &&
            item.data["schoolId"].referenceId() !in rule.allowedSchools &&
            known.count {
                it.data["lvl"].number() > 0 &&
                    it.data["schoolId"].referenceId() !in rule.allowedSchools
            } >= rule.unrestricted
    )
        add("Лимит заклинаний вне основных школ исчерпан.")
}

fun preparedSpellCount(entries: List<JsonElement>, items: Map<Long, CatalogueItem>) =
    entries.count {
        it.objectValue()["prepared"] == JsonPrimitive(true) &&
            items[it.referenceId()]?.data?.get("lvl").number() > 0
    }

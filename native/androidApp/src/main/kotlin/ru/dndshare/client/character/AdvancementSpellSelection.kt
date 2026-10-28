package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

data class SpellcastingRules(
    val ability: Int,
    val start: Int,
    val mode: String,
    val classId: Long?,
    val cantrips: Int?,
    val spells: Int?,
    val progression: Boolean,
    val levelUpChoices: Int,
    val allowedSchools: Set<Long>,
    val unrestricted: Int,
)

fun spellcastingRules(item: CatalogueItem?, level: Int): SpellcastingRules? {
    val data = item?.data?.get("spellcasting").objectValue()
    if (data.isEmpty() || level < data["start_level"].number(1)) return null
    fun row(key: String) =
        data[key]
            .arrayValue()
            .map { it.objectValue() }
            .filter { it["level"].number() <= level }
            .maxByOrNull { it["level"].number() }
            .objectValue()
    val known = row("known_progression")
    return SpellcastingRules(
        data["ability"].number(),
        data["start_level"].number(1),
        data.text("selection_mode").ifBlank {
            if (data["prepares"] == JsonPrimitive(true)) "prepared" else "known"
        },
        data["list_class"].referenceId(),
        (known["cantrips"] ?: data["cantrips_known"])?.number(),
        (known["spells"] ?: data["spells_known"])?.number(),
        data["known_progression"].arrayValue().isNotEmpty(),
        data["level_up_choices"].number(),
        data["allowed_schools"].arrayValue().mapNotNull { it.referenceId() }.toSet(),
        row("unrestricted_progression")["count"].number(),
    )
}

data class AdvancementSpellSelection(val plan: LevelAdvancement) {
    val rules =
        spellcastingRules(plan.subclass, plan.classLevel)
            ?: spellcastingRules(plan.charClass, plan.classLevel)
    val tab =
        plan.sheet.values["spells"]
            .objectValue()["tabs"]
            .arrayValue()
            .map { it.objectValue() }
            .firstOrNull { it["class_item_id"].referenceId() == plan.classId }
            .objectValue()
    val original = tab["spells"].arrayValue().mapNotNull { it.referenceId() }
    val selected =
        if (plan.input["spells"] is JsonArray)
            plan.input["spells"].arrayValue().mapNotNull { it.referenceId() }
        else original
    val first = rules?.let { plan.classLevel == it.start } == true
    val maxCircle =
        spellSlotPools(
                listOf(
                    buildJsonObject {
                        put("id", plan.classId ?: 0)
                        put("level", plan.classLevel)
                        plan.subclassId?.let { put("subclass", it) }
                    }
                ),
                plan.items,
            )
            .values
            .flatMap { it.arrayValue() }
            .maxOfOrNull { it.objectValue()["level"].number() } ?: 0

    fun circle(id: Long) = plan.items[id]?.data?.get("lvl").number(-1)

    fun errors(): List<String> = buildList {
        val rule = rules ?: return@buildList
        if (selected.distinct().size != selected.size) add("Повторяющиеся заклинания.")
        val missing = selected.filter { it !in plan.items }
        if (missing.isNotEmpty()) add("Дождитесь загрузки справочника заклинаний.")
        for (id in selected - original.toSet()) addAll(
            eligibility(plan.items[id], ignoreDuplicate = true)
        )
        val added = selected - original.toSet()
        val removed = original - selected.toSet()
        if (removed.any { circle(it) == 0 } && rule.mode != "prepared")
            add("На повышении нельзя заменить заговор этим действием.")
        val replacements =
            if (rule.mode == "known" && !first) 1
            else if (rule.mode == "prepared") Int.MAX_VALUE else 0
        if (removed.size > replacements) add("Превышено число замен заклинаний.")
        val cantripLimit = if (rule.progression || first) rule.cantrips else null
        if (
            cantripLimit != null &&
                selected.count { circle(it) == 0 } >
                    maxOf(cantripLimit, original.count { circle(it) == 0 })
        )
            add("Превышен лимит заговоров: $cantripLimit.")
        if (rule.mode == "spellbook") {
            val budget = if (first) rule.spells else rule.levelUpChoices.takeIf { it > 0 }
            if (budget != null && added.count { circle(it) > 0 } > budget)
                add("Можно изучить новых заклинаний: $budget.")
        } else if (
            (rule.progression || first) &&
                rule.spells != null &&
                selected.count { circle(it) > 0 } >
                    maxOf(rule.spells, original.count { circle(it) > 0 })
        )
            add("Превышен лимит заклинаний: ${rule.spells}.")
    }

    fun eligibility(item: CatalogueItem?, ignoreDuplicate: Boolean = false): List<String> =
        buildList {
            val rule = rules ?: return@buildList
            if (item == null) {
                add("Заклинание недоступно.")
                return@buildList
            }
            val circle = item.data["lvl"].number(-1)
            if (circle !in 0..maxCircle) add("Круг пока недоступен этому классу.")
            if (
                rule.classId != null &&
                    item.data["classes"].arrayValue().none { it.referenceId() == rule.classId }
            )
                add("Не входит в список класса.")
            if (!ignoreDuplicate && item.id in selected) add("Уже выбрано.")
            if (
                circle > 0 &&
                    rule.allowedSchools.isNotEmpty() &&
                    item.data["schoolId"].referenceId() !in rule.allowedSchools
            ) {
                val count =
                    selected
                        .filter { it != item.id && circle(it) > 0 }
                        .count {
                            plan.items[it]?.data?.get("schoolId").referenceId() !in
                                rule.allowedSchools
                        }
                if (count >= rule.unrestricted) add("Лимит заклинаний вне основных школ исчерпан.")
            }
        }
}

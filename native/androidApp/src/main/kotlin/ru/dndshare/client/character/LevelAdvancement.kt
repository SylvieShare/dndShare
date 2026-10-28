package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.creation.*
import ru.dndshare.client.model.*

data class LevelAdvancement(
    val sheet: CharacterSheet,
    val input: JsonObject,
    val items: Map<Long, CatalogueItem>,
    val metadata: HandbookMetadata = HandbookMetadata(),
) {
    val oldClasses =
        sheet.values["classes"]
            .arrayValue()
            .map { it.objectValue() }
            .map { row ->
                if (sheet.values["classes"].arrayValue().size == 1)
                    JsonObject(
                        row +
                            ("level" to
                                JsonPrimitive(sheet.values["lvl"].objectValue()["level"].number(1)))
                    )
                else row
            }
    val total = sheet.values["lvl"].objectValue()["level"].number(1)
    val classId =
        input["classId"].referenceId() ?: oldClasses.firstOrNull()?.get("id").referenceId()
    val charClass = items[classId]
    val oldClass = oldClasses.firstOrNull { it["id"].referenceId() == classId }
    val classLevel = oldClass?.get("level").number() + 1
    val subclassId = input["subclassId"].referenceId() ?: oldClass?.get("subclass").referenceId()
    val subclass = items[subclassId]
    val face =
        (subclass?.data?.text("hit_die")?.ifBlank { null } ?: charClass?.data?.text("hit_die"))
            .orEmpty()
            .filter(Char::isDigit)
            .toIntOrNull() ?: 8
    val hpGain =
        maxOf(
            1,
            (if (input.text("hpMethod") == "roll") (input["hpRoll"] as? JsonPrimitive)?.intOrNull
            else null) ?: (face / 2 + 1),
        ) + abilityModifier(sheet.statScore("CON"))
    val asiLevels =
        (charClass
            ?.data
            ?.text("asi_levels")
            .orEmpty()
            .split(Regex("[,;\\s]+"))
            .mapNotNull(String::toIntOrNull)
            .ifEmpty { listOf(4, 8, 12, 16, 19) })
    val hasAsi = classLevel in asiLevels
    val feat = items[input["featId"].referenceId()]
    val newFeatures
        get() =
            items.values
                .filter { item ->
                    item.typeId == 4L &&
                        item.data["selection_parent_id"].referenceId() == null &&
                        item.data["level"].number(1) <= classLevel &&
                        item.data["class_ids"].arrayValue().any { it.referenceId() == classId } &&
                        (item.data["subclass_ids"].arrayValue().isEmpty() ||
                            item.data["subclass_ids"].arrayValue().any {
                                it.referenceId() == subclassId
                            }) &&
                        sheet.values["abilities_class"].arrayValue().none {
                            it.referenceId() == item.id
                        }
                }
                .sortedWith(compareBy({ it.data["level"].number(1) }, { it.name }))

    fun choices(item: CatalogueItem): JsonObject =
        (input["choices"].objectValue()[item.id.toString()]
                ?: ownedFeatures(sheet, items)
                    .firstOrNull { it.item.id == item.id }
                    ?.entry
                    ?.get("choices"))
            .objectValue()

    fun selected(parent: CatalogueItem) =
        (input["selections"].objectValue()[parent.id.toString()]
                ?: JsonArray(selectedAbilityEntries(sheet, parent.id, items)))
            .arrayValue()
            .mapNotNull {
                items[it.referenceId()]
            }

    fun classesAfter(): List<JsonObject> {
        val item = charClass ?: return oldClasses
        val row =
            JsonObject(
                (oldClass ?: JsonObject(emptyMap())) +
                    mapOf(
                        "id" to JsonPrimitive(item.id),
                        "name" to JsonPrimitive(item.name),
                        "level" to JsonPrimitive(classLevel),
                        "subclass" to
                            (subclass?.let {
                                buildJsonObject {
                                    put("id", it.id)
                                    put("name", it.name)
                                }
                            } ?: JsonNull),
                    )
            )
        return if (oldClass == null) oldClasses + row
        else oldClasses.map { if (it["id"].referenceId() == classId) row else it }
    }
}

fun levelAdvancementPatches(plan: LevelAdvancement): List<SheetPatch> {
    val sheet = plan.sheet
    val input = plan.input
    val values = sheet.values.toMutableMap()
    require(plan.total < 20) { "Достигнут 20 уровень." }
    val item = plan.charClass
    if (item == null) {
        require(plan.oldClasses.isEmpty()) { "Выберите класс." }
        return listOf(
            SheetPatch(
                path = sheetPath("values", "lvl"),
                value =
                    JsonObject(
                        values["lvl"].objectValue() +
                            mapOf(
                                "level" to JsonPrimitive(plan.total + 1),
                                "exp" to (input["exp"] ?: JsonPrimitive(0)),
                            )
                    ),
            )
        )
    }
    require(plan.classLevel <= 20)
    if (plan.oldClass == null && plan.oldClasses.isNotEmpty()) {
        val scores = creationStats.associateWith(sheet::statScore)
        for (candidate in plan.oldClasses.mapNotNull { plan.items[it.referenceId()] } + item) {
            val failed =
                multiclassRequirements[candidate.nameEn.orEmpty().trim().lowercase()]
                    .orEmpty()
                    .filter { alternatives -> alternatives.none { (scores[it] ?: 10) >= 13 } }
            require(failed.isEmpty()) {
                "${candidate.name}: требуется ${failed.joinToString(" и ") { it.joinToString(" или ")+" 13" }}."
            }
        }
    }
    require(
        plan.subclass == null ||
            plan.subclass.data["class"].referenceId() == item.id ||
            plan.subclass.id in item.data["subclasses"].arrayValue().mapNotNull { it.referenceId() }
    ) {
        "Подкласс относится к другому классу."
    }
    if (
        plan.classLevel >= item.data["subclass_level"].number(3) &&
            plan.items.values.any {
                it.typeId == 17L &&
                    (it.data["class"].referenceId() == item.id ||
                        it.id in
                            item.data["subclasses"].arrayValue().mapNotNull { ref ->
                                ref.referenceId()
                            })
            }
    )
        require(plan.subclass != null) { "Выберите подкласс." }
    values["lvl"] =
        JsonObject(
            values["lvl"].objectValue() +
                mapOf(
                    "level" to JsonPrimitive(plan.total + 1),
                    "exp" to (input["exp"] ?: JsonPrimitive(0)),
                )
        )
    values["classes"] = JsonArray(plan.classesAfter())
    val gain = plan.hpGain.coerceAtLeast(1)
    if (input.text("hpMethod") == "roll")
        require(input["hpRoll"].number() in 1..plan.face) { "Проверьте результат кости хитов." }
    val spellErrors = AdvancementSpellSelection(plan).errors()
    require(spellErrors.isEmpty()) { spellErrors.joinToString(" · ") }
    advancementProficiencies(plan, values)
    val hp = values["hp"].objectValue()
    val maximum = normalizedHpMaximum(hp["max"])
    val history =
        appendHealthHistory(
            hp,
            buildJsonObject {
                put("kind", "level")
                put("level", plan.total + 1)
                put("classId", item.id)
                put("className", item.name)
                put("classLevel", plan.classLevel)
                put("gain", gain)
            },
        )
    val dice = hp["hitDice"].arrayValue().map { it.objectValue() }.toMutableList()
    val die = "d${plan.face}"
    val at = dice.indexOfFirst { it.text("die") == die }
    if (at < 0)
        dice.add(
            buildJsonObject {
                put("die", die)
                put("total", 1)
                put("used", 0)
            }
        )
    else
        dice[at] = JsonObject(dice[at] + ("total" to JsonPrimitive(dice[at]["total"].number() + 1)))
    values["hp"] =
        JsonObject(
            hp +
                mapOf(
                    "max" to
                        JsonObject(
                            maximum + ("base" to JsonPrimitive(maximum["base"].number() + gain))
                        ),
                    "current" to JsonPrimitive(hp["current"].number() + gain),
                    "history" to history,
                    "hitDice" to JsonArray(dice),
                )
        )
    val features = plan.newFeatures.toMutableList()
    for (parent in
        (ownedFeatures(sheet, plan.items).map { it.item } + features.toList())
            .distinctBy { it.id }
            .filter { it.data["ability_selection"] is JsonObject }) {
        val projected = sheet.copy(data = JsonObject(sheet.data + ("values" to JsonObject(values))))
        val count = abilitySelectionCount(parent, projected)
        val selected = plan.selected(parent)
        if (count > 0 || selected.isNotEmpty()) {
            require(selected.size == count) { "${parent.name}: выберите $count." }
            require(selected.distinctBy { it.id }.size == selected.size) {
                "Одинаковые способности нельзя выбрать дважды."
            }
            val old = selectedAbilityEntries(sheet, parent.id, plan.items)
            require(
                old.count { raw -> selected.none { it.id == raw.referenceId() } } <=
                    abilityReplacementCount(parent, projected)
            ) {
                "${parent.name}: превышено число замен."
            }
            require(
                selected.all {
                    it.data["selection_parent_id"].referenceId() == parent.id &&
                        it.data["level"].number(1) <= ownerLevel(parent.data, projected)
                }
            ) {
                "Недоступный выбор способности."
            }
            features.addAll(selected)
        }
    }
    val oldAbilities =
        values["abilities_class"].arrayValue().filter { entry ->
            val parent =
                entry.objectValue()["selection_source"].referenceId()
                    ?: plan.items[entry.referenceId()]
                        ?.data
                        ?.get("selection_parent_id")
                        .referenceId()
            parent == null || input["selections"].objectValue()[parent.toString()] == null
        }
    val added =
        features
            .distinctBy { it.id }
            .filter { next -> oldAbilities.none { it.referenceId() == next.id } }
    values["abilities_class"] =
        JsonArray(
            oldAbilities +
                added.map {
                    val existing =
                        sheet.values["abilities_class"]
                            .arrayValue()
                            .firstOrNull { old -> old.referenceId() == it.id }
                            .objectValue()
                    if (existing.isNotEmpty())
                        JsonObject(existing + ("choices" to plan.choices(it)))
                    else
                        advancementFeatureEntry(
                            it,
                            plan,
                            sheet.copy(
                                data = JsonObject(sheet.data + ("values" to JsonObject(values)))
                            ),
                        )
                }
        )
    val removedIds =
        sheet.values["abilities_class"].arrayValue().mapNotNull { it.referenceId() }.toSet() -
            values["abilities_class"].arrayValue().mapNotNull { it.referenceId() }.toSet()
    if (removedIds.isNotEmpty())
        values["states"] =
            JsonArray(
                values["states"].arrayValue().filterNot {
                    val source = it.objectValue()["source"].objectValue()
                    source.text("kind") in setOf("ability", "feature_action") &&
                        source["item_id"].referenceId() in removedIds
                }
            )
    if (plan.hasAsi && input.text("asiMode") != "skip") {
        if (input.text("asiMode") == "feat") {
            val feat = requireNotNull(plan.feat) { "Выберите черту." }
            val failures =
                featRequirements(
                    feat,
                    creationStats.associateWith(sheet::statScore),
                    plan.total + 1,
                    plan.classesAfter().any {
                        casterKind(
                                plan.items[it.referenceId()],
                                plan.items[it["subclass"].referenceId()],
                            )
                            .isNotBlank()
                    },
                    plan.metadata.suggests["3"]
                        .orEmpty()
                        .filter { suggest ->
                            sheet.values["proficiencies"]
                                .objectValue()["Доспехи"]
                                .arrayValue()
                                .any { it.jsonPrimitive.content.equals(suggest.value, true) }
                        }
                        .map { it.id }
                        .toSet(),
                )
            require(failures.isEmpty()) { failures.joinToString(" · ") }
            val old = values["abilities_feats"].arrayValue()
            require(
                feat.data["repeatable"] == JsonPrimitive(true) ||
                    old.none { it.referenceId() == feat.id }
            ) {
                "Эта черта уже есть у персонажа."
            }
            val entry = advancementFeatureEntry(feat, plan, sheet)
            values["abilities_feats"] = JsonArray(old + entry)
            applyAdvancementFeat(
                values,
                feat,
                plan.choices(feat),
                plan.metadata,
                sheet,
                "feat:${entry.text("uid").ifBlank {feat.id.toString()}}",
            )
        } else {
            val deltas = creationStats.associateWith { input["asi"].objectValue()[it].number() }
            require(deltas.values.sum() == 2 && deltas.values.all { it in 0..2 }) {
                "Распределите два повышения характеристик."
            }
            deltas
                .filterValues { it > 0 }
                .forEach { (stat, delta) ->
                    require(sheet.statScore(stat) + delta <= 20) {
                        "Характеристика не может превышать 20."
                    }
                    appendAdvancementBonus(values, stat, delta, "Повышение (ур. ${plan.total+1})")
                }
        }
    }
    applyAdvancementSpellbook(plan, values, added)
    val evaluation = sheet.copy(data = JsonObject(sheet.data + ("values" to JsonObject(values))))
    for (feature in features.filter { it.data["selection_parent_id"].referenceId() != null }) {
        val parent =
            plan.items[feature.data["selection_parent_id"].referenceId()]
                ?: error("Набор способностей недоступен.")
        val failures = selectedAbilityEligibility(feature, parent, evaluation)
        require(failures.isEmpty()) { "${feature.name}: ${failures.joinToString(" · ")}" }
        validateEntryChoices(feature, plan.choices(feature))
    }
    validateChangedCharacterChoices(sheet, evaluation, plan.items, plan.metadata)
    return values.mapNotNull { (key, value) ->
        if (value == sheet.values[key]) null
        else SheetPatch(path = sheetPath("values", key), value = value)
    }
}

internal val multiclassRequirements =
    mapOf(
        "barbarian" to listOf(listOf("STR")),
        "bard" to listOf(listOf("CHA")),
        "cleric" to listOf(listOf("WIS")),
        "druid" to listOf(listOf("WIS")),
        "fighter" to listOf(listOf("STR", "DEX")),
        "monk" to listOf(listOf("DEX"), listOf("WIS")),
        "paladin" to listOf(listOf("STR"), listOf("CHA")),
        "ranger" to listOf(listOf("DEX"), listOf("WIS")),
        "rogue" to listOf(listOf("DEX")),
        "sorcerer" to listOf(listOf("CHA")),
        "warlock" to listOf(listOf("CHA")),
        "wizard" to listOf(listOf("INT")),
        "artificer" to listOf(listOf("INT")),
    )

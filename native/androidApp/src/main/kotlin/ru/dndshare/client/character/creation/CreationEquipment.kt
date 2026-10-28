package ru.dndshare.client.character.creation

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

data class EquipmentPick(
    val key: String,
    val label: String,
    val count: Int,
    val options: List<CatalogueItem>,
)

data class EquipmentBranch(
    val id: String,
    val label: String,
    val items: List<JsonObject>,
    val picks: List<EquipmentPick>,
    val gold: Int,
)

data class EquipmentGroup(val id: String, val label: String, val branches: List<EquipmentBranch>)

data class EquipmentPlan(
    val key: String,
    val fixed: List<JsonObject>,
    val fixedPicks: List<EquipmentPick>,
    val groups: List<EquipmentGroup>,
    val gold: Int,
)

private val classNames =
    mapOf(
        "варвар" to "barbarian",
        "бард" to "bard",
        "жрец" to "cleric",
        "друид" to "druid",
        "воин" to "fighter",
        "монах" to "monk",
        "паладин" to "paladin",
        "следопыт" to "ranger",
        "плут" to "rogue",
        "чародей" to "sorcerer",
        "колдун" to "warlock",
        "волшебник" to "wizard",
    )

fun classRuleKey(item: CatalogueItem?): String =
    item?.nameEn?.lowercase()?.substringBefore(' ')?.takeIf { it in classNames.values }
        ?: classNames[item?.name?.lowercase()]
        ?: ""

fun equipmentPlan(context: CreationContext): EquipmentPlan? {
    val key = classRuleKey(context.item("charClass"))
    val profile =
        if (context.draft.version == "2024")
            context.item("charClass")?.data?.get("starting_kit").objectValue()
        else context.rules["equipment"].objectValue()[key].objectValue()
    if (profile.isEmpty()) return null
    fun normalized(name: String) =
        name.trim().lowercase().replace('ё', 'е').let {
            when (it) {
                "деревянный щит" -> "щит"
                "кожаная броня" -> "кожаный доспех"
                else -> it
            }
        }
    fun resolve(raw: JsonElement): CatalogueItem? {
        if (raw is JsonPrimitive)
            return raw.referenceId()?.let(context.items::get)
                ?: context.catalogue.firstOrNull { normalized(it.name) == normalized(raw.content) }
        val row = raw.objectValue()
        row["item_id"].referenceId()?.let {
            return context.items[it]
        }
        return context.catalogue
            .filter { normalized(it.name) == normalized(row.text("name")) }
            .sortedWith(
                compareByDescending<CatalogueItem> {
                        (if (it.data["available_in_starting_shop"] == JsonPrimitive(true)) 4
                        else 0) +
                            (if (it.typeId == 12L) 2 else 0) +
                            (if (it.iconImageUrl != null) 1 else 0)
                    }
                    .thenBy { it.id }
            )
            .firstOrNull()
    }
    fun entry(raw: JsonElement): JsonObject {
        val item = resolve(raw)
        val row = raw.objectValue()
        return buildJsonObject {
            put("item_id", item?.id?.let(::JsonPrimitive) ?: JsonNull)
            put("name", item?.name ?: row.text("name"))
            put("count", row["count"].number(1).coerceAtLeast(1))
            put("typeId", item?.typeId ?: 0)
            val params = row["params"].objectValue().toMutableMap()
            if (item?.data?.text("measurement") == "length" && "length_ft" !in params)
                params["length_ft"] = JsonPrimitive(50)
            put("params", JsonObject(params))
        }
    }
    fun picks(raw: JsonElement?) =
        raw.arrayValue().map { value ->
            val row = value.objectValue()
            EquipmentPick(
                row.text("id"),
                row.text("label").ifBlank { "Предмет" },
                row["count"].number(1),
                row["options"].arrayValue().mapNotNull(::resolve),
            )
        }
    return EquipmentPlan(
        key,
        profile["fixed"].arrayValue().map(::entry),
        picks(profile["fixedPicks"]),
        profile["groups"].arrayValue().map { raw ->
            val group = raw.objectValue()
            EquipmentGroup(
                group.text("id"),
                group.text("label"),
                group["options"].arrayValue().map { rawBranch ->
                    val branch = rawBranch.objectValue()
                    EquipmentBranch(
                        branch.text("id"),
                        branch.text("label"),
                        branch["items"].arrayValue().map(::entry),
                        picks(branch["picks"]),
                        branch["gold"].number(),
                    )
                },
            )
        },
        profile["gold"].number(),
    )
}

fun selectedEquipment(context: CreationContext): Pair<List<JsonObject>, Int> {
    val plan = equipmentPlan(context) ?: return emptyList<JsonObject>() to 0
    val all = plan.fixed.toMutableList()
    var gold = plan.gold
    fun collectPicks(group: String, picks: List<EquipmentPick>) {
        val values = context.draft.equipmentChoices[group].objectValue()["picks"].objectValue()
        for (pick in picks) for (id in values[pick.key].arrayValue()) {
            val item = context.items[id.referenceId()] ?: continue
            all.add(
                buildJsonObject {
                    put("item_id", item.id)
                    put("name", item.name)
                    put("count", 1)
                    put("typeId", item.typeId)
                    put(
                        "params",
                        if (item.data.text("measurement") == "length")
                            buildJsonObject { put("length_ft", 50) }
                        else JsonObject(emptyMap()),
                    )
                }
            )
        }
    }
    collectPicks("__fixed", plan.fixedPicks)
    for (group in plan.groups) {
        val selected = context.draft.equipmentChoices[group.id].objectValue().text("optionId")
        val branch =
            group.branches.firstOrNull { it.id == selected }
                ?: group.branches.singleOrNull()
                ?: continue
        all.addAll(branch.items)
        gold += branch.gold
        collectPicks(group.id, branch.picks)
    }
    return all to gold
}

fun equipmentErrors(context: CreationContext): List<String> = buildList {
    if (context.draft.buyEquipment && context.draft.version == "2014") return@buildList
    val plan = equipmentPlan(context) ?: return@buildList
    fun check(group: String, picks: List<EquipmentPick>) {
        for (pick in picks) {
            val ids =
                context.draft.equipmentChoices[group]
                    .objectValue()["picks"]
                    .objectValue()[pick.key]
                    .arrayValue()
                    .mapNotNull { it.referenceId() }
            if (ids.size != pick.count || ids.any { id -> pick.options.none { it.id == id } })
                add("${pick.label}: выберите ${pick.count}.")
        }
    }
    check("__fixed", plan.fixedPicks)
    for (group in plan.groups) {
        val selected = context.draft.equipmentChoices[group.id].objectValue().text("optionId")
        val branch =
            group.branches.firstOrNull { it.id == selected } ?: group.branches.singleOrNull()
        if (branch == null) add("Выберите комплект снаряжения.") else check(group.id, branch.picks)
    }
}

fun backgroundEquipment(context: CreationContext): Pair<List<JsonObject>, Map<String, Int>> {
    val data = context.item("background")?.data ?: return emptyList<JsonObject>() to emptyMap()
    if (context.draft.version == "2024" && context.picked("backgroundGold").firstOrNull() == "yes")
        return emptyList<JsonObject>() to mapOf("3" to data["starting_gold"].number(50))
    val rows =
        (data["tool_items"].arrayValue() + data["equipment_items"].arrayValue())
            .map { it.objectValue() }
            .toMutableList()
    for (raw in data["item_choices"].arrayValue()) {
        val choice = raw.objectValue()
        val id =
            context.picked("background:${choice.text("key")}").firstOrNull()?.toLongOrNull()
                ?: continue
        if (
            choice["grants_tool_item"] == JsonPrimitive(true) ||
                choice["grants_equipment_item"] == JsonPrimitive(true)
        ) {
            val replacement =
                choice["replace_tool_item_id"].referenceId()
                    ?: choice["replace_equipment_item_id"].referenceId()
            if (replacement != null) rows.removeAll { it["item_id"].referenceId() == replacement }
            rows.add(
                buildJsonObject {
                    put("item_id", id)
                    put("count", 1)
                    put("params", JsonObject(emptyMap()))
                }
            )
        }
    }
    val resolved = rows.mapNotNull { row ->
        context.items[row["item_id"].referenceId()]?.let { item ->
            JsonObject(
                row +
                    mapOf(
                        "name" to JsonPrimitive(item.name),
                        "typeId" to JsonPrimitive(item.typeId),
                    )
            )
        }
    }
    val coins = linkedMapOf<String, Int>()
    for (raw in data["starting_coins"].arrayValue()) {
        val row = raw.objectValue()
        val id = row.text("currency_id")
        coins[id] = (coins[id] ?: 0) + row["amount"].number()
    }
    return resolved to coins
}

fun itemCopper(item: CatalogueItem): Int? {
    val cost = item.data["cost"].objectValue()
    val value = cost["value"]?.jsonPrimitive?.doubleOrNull ?: return null
    val multiplier =
        mapOf(1 to 1, 2 to 10, 3 to 100, 4 to 50, 5 to 1000)[cost["suggest_id"].number()]
            ?: return null
    return kotlin.math.round(value * multiplier).toInt().coerceAtLeast(0)
}

fun cartCopper(context: CreationContext): Int =
    context.draft.cart.sumOf { row ->
        context.items[row["item_id"].referenceId()]?.let { item ->
            val unit = itemCopper(item) ?: 0
            val quantity = item.data["purchase_quantity"].number(1).coerceAtLeast(1)
            kotlin.math.round(unit.toDouble() * row["count"].number(1) / quantity).toInt()
        } ?: 0
    }

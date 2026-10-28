package ru.dndshare.client.ui.character

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

internal fun inventoryFormInput(target: String, values: JsonObject): JsonObject {
    val kind = target.substringBefore(':')
    val body = target.substringAfter(':', "")
    val request =
        if (body == "new" || body.startsWith("new|")) body.split('|', limit = 4) else listOf(body)
    val uid = request.first()
    val seedSection = request.getOrNull(1).orEmpty()
    val seedSlot = request.getOrNull(2)?.toIntOrNull()
    val model = values["items"].objectValue()
    if (kind == "inventory-section")
        return buildJsonObject {
            val section =
                model["sections"]
                    .arrayValue()
                    .map { it.objectValue() }
                    .firstOrNull { it.text("id") == uid }
            put("id", section?.text("id") ?: UUID.randomUUID().toString())
            put("name", section?.text("name") ?: "Рюкзак")
        }
    val weapons = kind == "weapon"
    val entries =
        if (weapons) values["weapon"].arrayValue()
        else
            model["equipped"].arrayValue() +
                model["sections"].arrayValue().flatMap { it.objectValue()["items"].arrayValue() }
    val carried = if (weapons) inventoryEntry(model, uid) else null
    val entry =
        (entries.map { it.objectValue() }.firstOrNull { it.text("uid") == uid } ?: carried)
            .objectValue()
    val fromInventory =
        weapons &&
            carried != null &&
            values["weapon"].arrayValue().none { it.objectValue().text("uid") == uid }
    val section =
        model["sections"]
            .arrayValue()
            .map { it.objectValue() }
            .firstOrNull { row ->
                row["items"].arrayValue().any { it.objectValue().text("uid") == uid } ||
                    uid in row["slots"].objectValue()
            }
    return buildJsonObject {
        put("uid", entry.text("uid").ifBlank { UUID.randomUUID().toString() })
        if (fromInventory) put("fromInventory", true)
        put("item_id", entry["magic_item_id"] ?: entry["item_id"] ?: JsonNull)
        put("name", entry["override"].objectValue().text("name"))
        put("desc", entry["override"].objectValue().text("desc").ifBlank { entry.text("desc") })
        put("count", entry["count"] ?: JsonPrimitive(1))
        put("weight", entry["override"].objectValue()["weight"] ?: JsonPrimitive(""))
        put("consumable", entry["override"].objectValue()["consumable"] ?: JsonNull)
        put("icon_preset_id", entry["icon_preset_id"] ?: JsonNull)
        put(
            "section",
            seedSection.takeIf(String::isNotBlank)
                ?: section?.text("id")
                ?: model["sections"].arrayValue().firstOrNull().objectValue().text("id"),
        )
        if (seedSlot != null) put("slot", seedSlot)
        put("autoPick", request.getOrNull(3) == "catalog")
        put("equipped", model["equipped"].arrayValue().any { it.objectValue().text("uid") == uid })
        val params = entry["params"].objectValue()
        put(
            "params",
            if (entry["magic_item_id"].referenceId() != null)
                JsonObject(params + ("weapon_base_item_id" to (entry["item_id"] ?: JsonNull)))
            else params,
        )
        put("add_attacks", entry["add_attacks"] ?: JsonArray(emptyList()))
        put("proficient", entry["proficient"] ?: JsonPrimitive(false))
        put("stat_suggest_id", entry["stat_suggest_id"] ?: JsonNull)
    }
}

internal fun inventoryFormPatches(
    form: SheetFormFields,
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
): List<SheetPatch> {
    val target = form.target.split(':')
    val input = form.input
    val uid = input.text(if (target[0] == "inventory-section") "id" else "uid")
    require(uid.isNotBlank())
    val model = sheet.values["items"].objectValue()
    val sections = model["sections"].arrayValue().map { it.objectValue() }.toMutableList()
    val equipped = model["equipped"].arrayValue().map { it.objectValue() }.toMutableList()
    val remove = input["remove"] == JsonPrimitive(true)
    fun patch(key: String, value: JsonElement) =
        listOf(SheetPatch(path = sheetPath("values", key), value = value))
    if (target[0] == "inventory-section") {
        val index = sections.indexOfFirst { it.text("id") == uid }
        if (remove) {
            return inventoryActionPatches(
                sheet,
                uid,
                "inventory-section-delete",
                JsonObject(emptyMap()),
                items,
            )
        } else {
            val name = input.text("name").trim()
            require(name.isNotBlank()) { "Введите название раздела." }
            val section =
                JsonObject(
                    (sections.getOrNull(index)
                        ?: buildJsonObject {
                            put("id", uid)
                            put("items", JsonArray(emptyList()))
                            put("slots", JsonObject(emptyMap()))
                        }) + ("name" to JsonPrimitive(name))
                )
            if (index < 0) sections.add(section) else sections[index] = section
        }
        return patch(
            "items",
            JsonObject(
                model + mapOf("equipped" to JsonArray(equipped), "sections" to JsonArray(sections))
            ),
        )
    }
    val weapon = target[0] == "weapon"
    val previousEntries =
        if (weapon) sheet.values["weapon"].arrayValue()
        else equipped + sections.flatMap { it["items"].arrayValue() }
    val fromInventory = weapon && input["fromInventory"] == JsonPrimitive(true)
    val original =
        (previousEntries.map { it.objectValue() }.firstOrNull { it.text("uid") == uid }
                ?: if (fromInventory) inventoryEntry(model, uid) else null)
            .objectValue()
    require(!fromInventory || original.isNotEmpty()) { "Предмет уже перемещён из инвентаря." }
    val itemId = input["item_id"].referenceId()
    val item = items[itemId]
    require(remove || itemId != null || input.text("name").isNotBlank()) {
        "Выберите предмет или введите название."
    }
    if (weapon && !remove && itemId != null)
        require(item?.typeId == 1L || item?.typeId == 19L) { "Выберите оружие." }
    var entry =
        if (remove) original
        else
            JsonObject(
                (original - "magic_item_id") +
                    buildJsonObject {
                        put("uid", uid)
                        put("item_id", itemId?.let(::JsonPrimitive) ?: JsonNull)
                        val params =
                            (input["params"] ?: original["params"]).objectValue().toMutableMap()
                        if ("magic_bonus" in params)
                            params["magic_bonus"] =
                                JsonPrimitive(
                                    inputInteger(JsonObject(params), "magic_bonus", max = 3)
                                )
                        put("params", JsonObject(params))
                        if (!weapon) put("count", inputInteger(input, "count", 1, min = 1))
                        val overrides = original["override"].objectValue().toMutableMap()
                        if (!weapon && itemId == null) {
                            val rawWeight = input.text("weight").trim()
                            if (rawWeight.isBlank() || input["weight"] == JsonNull)
                                overrides.remove("weight")
                            else {
                                val weight = rawWeight.replace(',', '.').toDoubleOrNull()
                                require(weight != null && weight.isFinite() && weight >= 0) {
                                    "Введите неотрицательный вес."
                                }
                                overrides["weight"] = JsonPrimitive(weight)
                            }
                        }
                        if ((input["consumable"] as? JsonPrimitive)?.booleanOrNull != null)
                            overrides["consumable"] =
                                JsonPrimitive(input["consumable"] == JsonPrimitive(true))
                        put(
                            "icon_preset_id",
                            if (itemId == null)
                                input["icon_preset_id"]?.takeIf { (it.referenceId() ?: 0) > 0 }
                                    ?: JsonNull
                            else JsonNull,
                        )
                        for (key in listOf("name", "desc")) {
                            val text = input.text(key)
                            if (text.isNotBlank()) overrides[key] = JsonPrimitive(text)
                            else overrides.remove(key)
                        }
                        put(
                            "override",
                            if (overrides.isEmpty()) JsonNull else JsonObject(overrides),
                        )
                        if (weapon) {
                            put("proficient", input["proficient"] == JsonPrimitive(true))
                            put(
                                "stat_suggest_id",
                                if (input.text("stat_suggest_id").isBlank()) JsonNull
                                else
                                    JsonPrimitive(
                                        inputInteger(input, "stat_suggest_id", min = 1, max = 6)
                                    ),
                            )
                            put("desc", input.text("desc"))
                            put("add_attacks", validatedAdditionalAttacks(input["add_attacks"]))
                        }
                    }
            )
    if (!remove && item != null) {
        if (item.typeId == 19L) {
            val previousSource = (original["magic_item_id"] ?: original["item_id"]).referenceId()
            val previous =
                if (previousSource == item.id) original["params"].objectValue()
                else JsonObject(emptyMap())
            entry =
                JsonObject(
                    entry +
                        ("params" to
                            initializeMagicCharges(item, previous, entry["params"].objectValue()))
                )
        }
        val base =
            magicEquipmentBase(item, entry["params"].objectValue(), MagicEquipmentKind.Weapon)
        if (
            weapon ||
                item.typeId == 19L &&
                    item.data["weapon"] is JsonObject &&
                    (original["magic_item_id"] != null || base != null && base in items)
        )
            entry = materializeMagicWeapon(entry, item, items)
    }
    if (weapon && fromInventory) {
        require(!remove) { "Отмените перенос, чтобы оставить предмет в инвентаре." }
        require(previousEntries.none { it.objectValue().text("uid") == uid }) {
            "Это оружие уже перенесено."
        }
        val amount = original["count"].number(1).coerceAtLeast(1)
        val copies =
            (0 until amount).map { index ->
                JsonObject(
                    (entry - "count") +
                        ("uid" to
                            JsonPrimitive(if (index == 0) uid else UUID.randomUUID().toString()))
                )
            }
        val inventory =
            inventoryActionPatches(sheet, uid, "inventory-delete", JsonObject(emptyMap()), items)
        return inventory + patch("weapon", JsonArray(previousEntries + copies))
    }
    if (weapon) {
        val next = previousEntries.filter { it.objectValue().text("uid") != uid }.toMutableList()
        if (!remove) {
            val originalIndex = previousEntries.indexOfFirst { it.objectValue().text("uid") == uid }
            next.add(
                if (originalIndex < 0) next.size else originalIndex.coerceAtMost(next.size),
                entry,
            )
        }
        return patch("weapon", JsonArray(next))
    }
    val oldSection = sections.firstOrNull {
        uid in it["slots"].objectValue() ||
            it["items"].arrayValue().any { row -> row.objectValue().text("uid") == uid }
    }
    val sectionId = input.text("section").ifBlank { oldSection?.text("id").orEmpty() }
    if (!remove && sections.none { it.text("id") == sectionId }) {
        require(sectionId.isBlank()) { "Выбранный раздел больше не существует." }
        sections.add(
            buildJsonObject {
                put("id", "default")
                put("name", "Рюкзак")
                put("items", JsonArray(emptyList()))
                put("slots", JsonObject(emptyMap()))
            }
        )
    }
    val oldEquippedIndex = equipped.indexOfFirst { it.text("uid") == uid }
    equipped.removeAll { it.text("uid") == uid }
    for (index in sections.indices) {
        val section = sections[index]
        sections[index] =
            JsonObject(
                section +
                    mapOf(
                        "items" to
                            JsonArray(
                                section["items"].arrayValue().filter {
                                    it.objectValue().text("uid") != uid
                                }
                            ),
                        "slots" to JsonObject(section["slots"].objectValue() - uid),
                    )
            )
    }
    if (!remove) {
        val index = sections.indexOfFirst { it.text("id") == sectionId }.takeIf { it >= 0 } ?: 0
        val destination = sections[index]
        val slots = destination["slots"].objectValue()
        val used = slots.values.map { it.number() }.toSet()
        val oldSlot =
            oldSection
                ?.takeIf { it.text("id") == destination.text("id") }
                ?.get("slots")
                .objectValue()[uid]
                ?.number()
        val slot =
            input["slot"]?.number(-1)?.takeIf { it >= 0 && it !in used }
                ?: oldSlot?.takeIf { it !in used }
                ?: generateSequence(0) { it + 1 }.first { it !in used }
        val isEquipped = input["equipped"] == JsonPrimitive(true)
        val rows = destination["items"].arrayValue().toMutableList()
        if (isEquipped)
            equipped.add(
                if (oldEquippedIndex < 0) equipped.size
                else oldEquippedIndex.coerceAtMost(equipped.size),
                entry,
            )
        else {
            val oldIndex =
                oldSection
                    ?.takeIf { it.text("id") == destination.text("id") }
                    ?.get("items")
                    .arrayValue()
                    .indexOfFirst { it.objectValue().text("uid") == uid }
            rows.add(if (oldIndex < 0) rows.size else oldIndex.coerceAtMost(rows.size), entry)
        }
        sections[index] =
            JsonObject(
                destination +
                    mapOf(
                        "items" to JsonArray(rows),
                        "slots" to JsonObject(slots + (uid to JsonPrimitive(slot))),
                    )
            )
    }
    return patch(
        "items",
        JsonObject(
            model + mapOf("equipped" to JsonArray(equipped), "sections" to JsonArray(sections))
        ),
    )
}

internal fun validatedAdditionalAttacks(value: JsonElement?): JsonArray =
    JsonArray(
        value.arrayValue().map { raw ->
            val row = raw.objectValue()
            val die = row.text("dice_id")
            require(die in listOf("d4", "d6", "d8", "d10", "d12", "d20", "d100")) {
                "Выберите кость дополнительного урона."
            }
            JsonObject(
                row +
                    mapOf(
                        "count" to JsonPrimitive(inputInteger(row, "count", 1, min = 1, max = 100)),
                        "dice_id" to JsonPrimitive(die),
                        "type_suggest_id" to
                            (row["type_suggest_id"].referenceId()?.let(::JsonPrimitive)
                                ?: JsonNull),
                    )
            )
        }
    )

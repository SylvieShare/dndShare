package ru.dndshare.client.ui.character

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

internal fun spellFormInput(target: String, values: JsonObject): JsonObject {
    val parts = listOf(target.substringBefore(':')) + target.substringAfter(':', "").split('|')
    val book = values["spells"].objectValue()
    val tab =
        book["tabs"]
            .arrayValue()
            .map { it.objectValue() }
            .firstOrNull { it.text("key") == parts.getOrNull(1) }
            .objectValue()
    return when (parts[0]) {
        "spell-slots" -> book["slot_pools"].objectValue()
        "spell-tab" ->
            buildJsonObject {
                put("key", tab["key"] ?: JsonPrimitive("tab:${UUID.randomUUID()}"))
                put("name", tab["name"] ?: JsonPrimitive("Магия"))
                put("mode", tab["mode"] ?: JsonPrimitive("known"))
                put("casting_ability", tab["casting_ability"] ?: JsonPrimitive(""))
                put("class_item_id", tab["class_item_id"] ?: JsonNull)
                put("attack_bonus", tab["attack_bonus"] ?: JsonPrimitive(0))
                put("save_bonus", tab["save_bonus"] ?: JsonPrimitive(0))
            }
        else -> {
            val entry =
                tab["spells"]
                    .arrayValue()
                    .map { it.objectValue() }
                    .firstOrNull { it.text("key") == parts.getOrNull(2) }
                    .objectValue()
            buildJsonObject {
                put("key", entry["key"] ?: JsonPrimitive("spell:${UUID.randomUUID()}"))
                put("tab", tab.text("key"))
                put("id", entry["id"] ?: JsonNull)
                put("prepared", entry["prepared"] ?: JsonPrimitive(false))
            }
        }
    }
}

internal fun spellFormPatches(
    form: SheetFormFields,
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
): List<SheetPatch> {
    val target = form.target.split(':')
    val input = form.input
    val original = sheet.values["spells"].objectValue()
    val book = original.toMutableMap()
    book["schema_version"] = JsonPrimitive(2)
    if ("slot_pools" !in book)
        book["slot_pools"] = buildJsonObject {
            put("long_rest", JsonArray(emptyList()))
            put("short_rest", JsonArray(emptyList()))
        }
    if ("grants" !in book) book["grants"] = JsonArray(emptyList())
    val tabs = original["tabs"].arrayValue().map { it.objectValue() }.toMutableList()
    val remove = input["remove"] == JsonPrimitive(true)
    when (target[0]) {
        "spell-slots" -> book["slot_pools"] = buildJsonObject {
                for (pool in listOf("long_rest", "short_rest")) put(
                    pool,
                    JsonArray(
                        input[pool].arrayValue().map { raw ->
                            val row = raw.objectValue()
                            val total = inputInteger(row, "total")
                            val used = inputInteger(row, "used", max = total)
                            JsonObject(
                                row +
                                    mapOf(
                                        "level" to
                                            JsonPrimitive(
                                                inputInteger(row, "level", min = 1, max = 9)
                                            ),
                                        "total" to JsonPrimitive(total),
                                        "used" to JsonPrimitive(used),
                                    )
                            )
                        }
                    ),
                )
            }
        "spell-tab" -> {
            val key = input.text("key")
            val index = tabs.indexOfFirst { it.text("key") == key }
            val old = tabs.getOrNull(index).objectValue()
            if (remove) {
                require(index >= 0)
                tabs.removeAt(index)
                book["grants"] =
                    JsonArray(
                        book["grants"].arrayValue().map { raw ->
                            val grant = raw.objectValue()
                            if (grant.text("tab_key") == key) JsonObject(grant - "tab_key")
                            else grant
                        }
                    )
            } else {
                require(input.text("name").isNotBlank()) { "Введите название книги." }
                require(input.text("mode") in setOf("known", "prepared", "spellbook"))
                val ability =
                    input.text("casting_ability").takeIf(String::isNotBlank)?.toIntOrNull()
                require(
                    input.text("casting_ability").isBlank() || ability != null && ability in 1..6
                ) {
                    "Выберите заклинательную характеристику."
                }
                val sourceId = input["class_item_id"].referenceId()
                require(
                    sourceId == null ||
                        tabs.none {
                            it.text("key") != key && it["class_item_id"].referenceId() == sourceId
                        }
                ) {
                    "У этого класса уже есть книга."
                }
                val tab =
                    JsonObject(
                        old + input - "remove" +
                            mapOf(
                                "casting_ability" to
                                    (ability?.let(::JsonPrimitive) ?: JsonPrimitive("")),
                                "class_item_id" to (sourceId?.let(::JsonPrimitive) ?: JsonNull),
                                "attack_bonus" to
                                    JsonPrimitive(
                                        inputInteger(input, "attack_bonus", min = -100, max = 100)
                                    ),
                                "save_bonus" to
                                    JsonPrimitive(
                                        inputInteger(input, "save_bonus", min = -100, max = 100)
                                    ),
                                "spells" to (old["spells"] ?: JsonArray(emptyList())),
                            )
                    )
                if (index < 0) tabs.add(tab) else tabs[index] = tab
            }
        }
        "spell" -> {
            val key = input.text("key")
            val originalIndex = tabs.indexOfFirst { tab ->
                tab["spells"].arrayValue().any { it.objectValue().text("key") == key }
            }
            val originalEntry =
                tabs
                    .getOrNull(originalIndex)
                    ?.get("spells")
                    .arrayValue()
                    .firstOrNull { it.objectValue().text("key") == key }
                    .objectValue()
            if (remove) {
                require(originalIndex >= 0) { "Заклинание больше не существует." }
                val originalTab = tabs[originalIndex]
                tabs[originalIndex] =
                    JsonObject(
                        originalTab +
                            ("spells" to
                                JsonArray(
                                    originalTab["spells"].arrayValue().filterNot {
                                        it.objectValue().text("key") == key
                                    }
                                ))
                    )
            } else {
                val tabIndex = tabs.indexOfFirst { it.text("key") == input.text("tab") }
                require(tabIndex >= 0) { "Книга больше не существует." }
                val tab = tabs[tabIndex]
                val entries = tab["spells"].arrayValue().map { it.objectValue() }.toMutableList()
                val index = entries.indexOfFirst { it.text("key") == key }
                val id = input["id"].referenceId() ?: error("Выберите заклинание.")
                require(items[id]?.typeId == 5L) { "Выберите заклинание из справочника." }
                require(entries.none { it["id"].referenceId() == id && it.text("key") != key }) {
                    "Заклинание уже есть в книге."
                }
                if (
                    originalEntry.referenceId() != id && originalIndex == tabIndex ||
                        originalIndex < 0
                ) {
                    val reasons = spellBookEligibility(sheet, tab, items.getValue(id), items, key)
                    require(reasons.isEmpty()) { reasons.joinToString(" · ") }
                }
                val entry =
                    JsonObject(
                        originalEntry +
                            mapOf(
                                "key" to JsonPrimitive(key),
                                "id" to JsonPrimitive(id),
                                "prepared" to
                                    JsonPrimitive(
                                        input["prepared"] == JsonPrimitive(true) &&
                                            items[id]?.data?.get("lvl").number() > 0 &&
                                            tab.text("mode") != "known"
                                    ),
                            )
                    )
                if (originalIndex >= 0 && originalIndex != tabIndex) {
                    val old = tabs[originalIndex]
                    tabs[originalIndex] =
                        JsonObject(
                            old +
                                ("spells" to
                                    JsonArray(
                                        old["spells"].arrayValue().filterNot {
                                            it.objectValue().text("key") == key
                                        }
                                    ))
                        )
                }
                if (index < 0) entries.add(entry) else entries[index] = entry
                if (originalIndex == tabIndex || originalIndex < 0)
                    spellBookRules(sheet, tab, items)?.preparedLimit?.let { limit ->
                        val oldCount = preparedSpellCount(tab["spells"].arrayValue(), items)
                        val newCount = preparedSpellCount(entries, items)
                        require(newCount <= limit || newCount <= oldCount) {
                            "Превышен лимит подготовленных заклинаний: $limit."
                        }
                    }
                tabs[tabIndex] = JsonObject(tab + ("spells" to JsonArray(entries)))
            }
        }
    }
    book["tabs"] = JsonArray(tabs)
    val patches = listOf(SheetPatch(path = sheetPath("values", "spells"), value = JsonObject(book)))
    if (target[0] != "spell" || !remove) return patches
    val key = input.text("key")
    val old = findSpellReference(sheet, key)
    val states =
        sheet.values["states"].arrayValue().filterNot { raw ->
            val source = raw.objectValue()["source"].objectValue()
            source.text("kind") == "spell" &&
                source["item_id"].referenceId() == old?.referenceId() &&
                source.text("entry_key") == key
        }
    return if (states == sheet.values["states"].arrayValue()) patches
    else
        patches +
            SheetPatch(
                path = sheetPath("values", "states"),
                value =
                    JsonArray(
                        withStatusEndEffects(sheet.values["states"].arrayValue(), states, items)
                    ),
            )
}

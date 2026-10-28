package ru.dndshare.client.ui.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

internal val personalityFields =
    linkedMapOf(
        "person_origin" to "Происхождение",
        "person_alignment" to "Мировоззрение",
        "person_appearance" to "Внешность",
        "person_height" to "Рост",
        "person_weight" to "Вес",
        "person_age" to "Возраст",
        "person_eyes" to "Глаза",
        "person_skin" to "Кожа",
        "person_hair" to "Волосы",
        "person_traits" to "Черты характера",
        "person_ideals" to "Идеалы",
        "person_bonds" to "Привязанности",
        "person_flaws" to "Слабости",
        "person_backstory" to "Предыстория персонажа",
        "person_allies" to "Союзники и организации",
    )

internal fun isFeatureForm(target: String) =
    isCommandForm(target) ||
        target.substringBefore(':') in
            setOf(
                "reorder",
                "notes",
                "portrait",
                "icon",
                "sources",
                "identity",
                "personality",
                "money",
                "skill",
                "utility",
                "proficiencies",
                "inventory",
                "inventory-section",
                "vtm-health",
                "vtm-blood",
                "vtm-list",
                "weapon",
                "spell",
                "spell-tab",
                "spell-slots",
                "resource",
                "defense",
                "action",
                "ability",
                "ability-selection",
                "rest",
                "level",
                "vtm-text",
            )

internal fun initialFeatureInput(
    target: String,
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem> = emptyMap(),
): JsonObject {
    val parts = target.split(':')
    val values = sheet.values
    return when (parts[0]) {
        "reorder" -> initialReorderInput(target, sheet, items)
        "sources" -> sheet.data["settings"].objectValue()["contentSources"].objectValue()
        "identity" -> identityFormInput(sheet)
        "notes" -> buildJsonObject { put("value", values.text("notes")) }
        "personality" ->
            buildJsonObject {
                val key = parts.getOrNull(1)
                require(key in personalityFields) { "Поле личности недоступно." }
                put(key!!, values.text(key))
            }
        "money" -> values["money"].objectValue()["amounts"].objectValue()
        "utility" -> values[parts.getOrNull(1)].objectValue()
        "skill" -> {
            val stat = values[parts.getOrNull(1)].objectValue()
            if (parts.getOrNull(2) == "save")
                buildJsonObject {
                    put("up", stat["save_up"] ?: JsonPrimitive(false))
                    put("bonuses", stat["save_bonuses"] ?: JsonArray(emptyList()))
                    put("roll_mode", stat["save_roll_mode"] ?: JsonPrimitive("auto"))
                }
            else
                stat["skills"].objectValue()[parts.getOrNull(2)].objectValue().let { row ->
                    JsonObject(
                        row +
                            mapOf(
                                "up" to (row["up"] ?: JsonPrimitive(0)),
                                "roll_mode" to (row["roll_mode"] ?: JsonPrimitive("auto")),
                            )
                    )
                }
        }
        "proficiencies" ->
            buildJsonObject {
                values["proficiencies"].objectValue().forEach { (key, rows) ->
                    put(
                        key,
                        rows.arrayValue().joinToString("\n") {
                            (it as? JsonPrimitive)?.content.orEmpty()
                        },
                    )
                }
            }
        "inventory",
        "inventory-section",
        "weapon" -> inventoryFormInput(target, values)
        "spell",
        "spell-tab",
        "spell-slots" -> spellFormInput(target, values)
        "resource",
        "defense",
        "action",
        "ability" -> featureEntryInput(target, values)
        "ability-selection" -> {
            val id = parts.getOrNull(1)?.toLongOrNull() ?: error("Набор способностей недоступен.")
            buildJsonObject {
                put("parentId", id)
                put(
                    "entries",
                    JsonArray(selectedAbilityEntries(sheet, id, items)),
                )
            }
        }
        "rest" -> buildJsonObject { put("kind", "short") }
        "level" ->
            buildJsonObject { put("exp", values["lvl"].objectValue()["exp"] ?: JsonPrimitive(0)) }
        "vtm-health",
        "vtm-blood",
        "vtm-list" -> vtmFormInput(target, sheet)
        "vtm-text" -> buildJsonObject { put("value", values.text(parts.getOrElse(1) { "" })) }
        else -> JsonObject(emptyMap())
    }
}

internal fun inputInteger(
    input: JsonObject,
    key: String,
    default: Int = 0,
    min: Int = 0,
    max: Int = Int.MAX_VALUE,
): Int {
    val raw = input.text(key)
    val number = if (raw.isBlank()) default else raw.toIntOrNull() ?: error("Введите целое число.")
    require(number in min..max) { "Значение должно быть от $min до $max." }
    return number
}

internal fun featureFormPatches(
    form: SheetFormFields,
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
    metadata: HandbookMetadata = HandbookMetadata(),
): List<SheetPatch> {
    val target = form.target.split(':')
    val input = form.input
    val values = sheet.values
    fun patch(key: String, value: JsonElement) =
        listOf(SheetPatch(path = sheetPath("values", key), value = value))
    return when (target[0]) {
        "reorder" -> reorderFormPatches(form, sheet, items)
        "sources" -> {
            val ids =
                input["ids"]
                    .arrayValue()
                    .mapNotNull { it.referenceId() }
                    .filter { it > 0 }
                    .distinct()
            val settings = sheet.data["settings"].objectValue()
            val sources = buildJsonObject {
                put("mode", if (input.text("mode") == "selected") "selected" else "all")
                put("ids", JsonArray(ids.map(::JsonPrimitive)))
                put("allowLegacy", input["allowLegacy"] == JsonPrimitive(true))
            }
            listOf(
                SheetPatch(
                    path = sheetPath("settings"),
                    value = JsonObject(settings + ("contentSources" to sources)),
                )
            )
        }
        "identity" -> identityFormPatches(form, sheet, items)
        "notes" -> patch("notes", JsonPrimitive(input.text("value")))
        "personality" ->
            listOf(target.getOrElse(1) { error("Поле личности недоступно.") }).mapNotNull { key ->
                require(key in personalityFields) { "Поле личности недоступно." }
                input[key]
                    ?.takeIf { it != values[key] }
                    ?.let { SheetPatch(path = sheetPath("values", key), value = it) }
            }
        "money" -> {
            val amounts = values["money"].objectValue()["amounts"].objectValue().toMutableMap()
            for ((key, _) in
                input.filterKeys { it.toLongOrNull()?.let { id -> id > 0 } == true }) amounts[key] =
                JsonPrimitive(walletAmount(input, key))
            patch(
                "money",
                JsonObject(
                    values["money"].objectValue() +
                        mapOf(
                            "amounts" to JsonObject(amounts),
                            "order" to
                                (values["money"].objectValue()["order"]
                                    ?: JsonArray(
                                        input.keys
                                            .filter {
                                                it.toLongOrNull()?.let { id -> id > 0 } == true
                                            }
                                            .map {
                                                it.toLongOrNull()?.let(::JsonPrimitive)
                                                    ?: JsonPrimitive(it)
                                            }
                                    )),
                        )
                ),
            )
        }
        "utility" -> {
            val key = target[1]
            require(key in setOf("armor", "initiative", "speed", "prof_bonus"))
            val numericKey = if (key == "prof_bonus") "v" else "base"
            val row = values[key].objectValue().toMutableMap()
            if (key != "armor")
                row[numericKey] =
                    JsonPrimitive(
                        inputInteger(input, numericKey, min = if (key == "initiative") -100 else 0)
                    )
            for (flag in listOf("auto", "use_dex")) if (flag in input)
                row[flag] = JsonPrimitive(input[flag] == JsonPrimitive(true))
            input["bonuses"]?.let { row["bonuses"] = validatedBonuses(it) }
            patch(key, JsonObject(row))
        }
        "skill" -> {
            val stat = target[1]
            val id = target[2]
            val current = values[stat].objectValue()
            if (id == "save")
                patch(
                    stat,
                    JsonObject(
                        current +
                            mapOf(
                                "save_up" to JsonPrimitive(input["up"] == JsonPrimitive(true)),
                                "save_bonuses" to validatedBonuses(input["bonuses"]),
                                "save_roll_mode" to
                                    JsonPrimitive(input.text("roll_mode").ifBlank { "auto" }),
                            )
                    ),
                )
            else {
                val skills = current["skills"].objectValue()
                val original = skills[id].objectValue()
                val updated =
                    JsonObject(
                        original +
                            mapOf(
                                "up" to JsonPrimitive(inputInteger(input, "up", max = 2)),
                                "override_title" to JsonPrimitive(input.text("override_title")),
                                "roll_mode" to
                                    JsonPrimitive(input.text("roll_mode").ifBlank { "auto" }),
                                "bonuses" to validatedBonuses(input["bonuses"]),
                            )
                    )
                patch(
                    stat,
                    JsonObject(current + ("skills" to JsonObject(skills + (id to updated)))),
                )
            }
        }
        "proficiencies" ->
            patch(
                "proficiencies",
                buildJsonObject {
                    for ((key, value) in input) put(
                        key,
                        JsonArray(
                            value.jsonPrimitive.content
                                .split('\n', ',')
                                .map(String::trim)
                                .filter(String::isNotBlank)
                                .distinct()
                                .map(::JsonPrimitive)
                        ),
                    )
                },
            )
        "inventory",
        "inventory-section",
        "weapon" -> inventoryFormPatches(form, sheet, items)
        "spell",
        "spell-tab",
        "spell-slots" -> spellFormPatches(form, sheet, items)
        "resource",
        "defense",
        "action",
        "ability" -> featureEntryPatches(form, sheet, items, metadata)
        "ability-selection" ->
            applyAbilitySelection(
                sheet,
                items[input["parentId"].referenceId()] ?: error("Набор способностей недоступен."),
                input["entries"].arrayValue(),
                items,
                metadata,
            )
        "rest" -> restPatches(sheet, input, items)
        "level" -> levelFormPatches(sheet, input, items, metadata)
        "vtm-health",
        "vtm-blood",
        "vtm-list" -> vtmFeaturePatches(form, sheet)
        "vtm-text" -> patch(target[1], JsonPrimitive(input.text("value")))
        else -> error("Неизвестная форма.")
    }
}

internal fun validatedBonuses(raw: JsonElement?): JsonArray =
    JsonArray(
        raw.arrayValue().map { value ->
            val row = value.objectValue()
            val number = row.text("value").toIntOrNull() ?: error("Введите числовой бонус.")
            JsonObject(row + ("value" to JsonPrimitive(number)))
        }
    )

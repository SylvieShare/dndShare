package ru.dndshare.client.ui.character

import java.util.UUID
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

internal fun identityFormInput(sheet: CharacterSheet): JsonObject = buildJsonObject {
    put("name", sheet.values.text(if (sheet.templateName == "VTM20") "char_name" else "name"))
    if (sheet.templateName == "DND5") {
        for (key in listOf("race", "subrace")) put(key, sheet.values[key] ?: JsonNull)
        put(
            "classes",
            JsonArray(
                sheet.values["classes"].arrayValue().map {
                    JsonObject(
                        it.objectValue() + ("_key" to JsonPrimitive(UUID.randomUUID().toString()))
                    )
                }
            ),
        )
    }
}

internal fun identityChildMatches(
    parent: CatalogueItem?,
    child: CatalogueItem,
    kind: String,
    parentId: Long?,
): Boolean =
    parentId != null &&
        (child.data[if (kind == "subrace") "race" else "class"].referenceId() == parentId ||
            child.id in
                parent
                    ?.data
                    ?.get(if (kind == "subrace") "subraces" else "subclasses")
                    .arrayValue()
                    .mapNotNull { it.referenceId() })

internal fun identityFormPatches(
    form: SheetFormFields,
    sheet: CharacterSheet,
    items: Map<Long, CatalogueItem>,
): List<SheetPatch> = buildList {
    val input = form.input
    val name = input.text("name").trim()
    require(name.isNotBlank()) { "Введите имя персонажа." }
    fun patch(key: String, value: JsonElement) {
        add(SheetPatch(path = sheetPath("values", key), value = value))
    }
    patch(if (sheet.templateName == "VTM20") "char_name" else "name", JsonPrimitive(name))
    if (sheet.templateName != "DND5") return@buildList
    if (input["race"] != sheet.values["race"] && input["subrace"].referenceId() != null) {
        val parentId = input["race"].referenceId()
        val child = items[input["subrace"].referenceId()]
        require(
            child != null && identityChildMatches(items[parentId], child, "subrace", parentId)
        ) {
            "Происхождение относится к другой расе."
        }
    }
    for (key in listOf("race", "subrace")) {
        val raw = input[key] ?: continue
        if (raw == sheet.values[key]) continue
        val id = raw.referenceId()
        if (id == null) {
            patch(key, JsonNull)
            continue
        }
        val item = items[id] ?: error("Дождитесь загрузки выбранного происхождения.")
        require(item.typeId == if (key == "race") 8L else 16L) {
            "Выберите подходящее происхождение."
        }
        if (key == "subrace") {
            val parentId = input["race"].referenceId()
            require(identityChildMatches(items[parentId], item, key, parentId)) {
                "Происхождение относится к другой расе."
            }
        }
        patch(
            key,
            buildJsonObject {
                put("id", item.id)
                put("name", item.name)
            },
        )
    }
    if (input["_classesChanged"] != JsonPrimitive(true)) return@buildList
    val rows = input["classes"].arrayValue().map { it.objectValue() }
    require(rows.isNotEmpty()) { "Добавьте хотя бы один класс." }
    val ids = rows.map { it["id"].referenceId() ?: error("Выберите класс для каждой строки.") }
    require(ids.distinct().size == ids.size) { "Каждый класс можно добавить только один раз." }
    val old = sheet.values["classes"].arrayValue().map { it.objectValue() }
    var total = 0
    val classes = rows.map { row ->
        val id = row["id"].referenceId()!!
        val item = items[id]
        val previous = old.firstOrNull { it["id"].referenceId() == id }
        require(item?.typeId == 9L || previous != null) { "Выбранный класс недоступен." }
        val level = inputInteger(row, "level", min = 1, max = 20)
        total += level
        val sub = row["subclass"].objectValue()
        val subId = sub["id"].referenceId()
        if (subId != null && subId != previous?.get("subclass").referenceId()) {
            val subclass = items[subId] ?: error("Дождитесь загрузки подкласса.")
            require(
                subclass.typeId == 17L && identityChildMatches(item, subclass, "subclass", id)
            ) {
                "Подкласс относится к другому классу."
            }
        }
        buildJsonObject {
            put("id", id)
            put("name", item?.name ?: previous!!.text("name"))
            put("level", level)
            put(
                "subclass",
                if (subId == null) JsonNull
                else
                    buildJsonObject {
                        put("id", subId)
                        put("name", items[subId]?.name ?: sub.text("name"))
                    },
            )
        }
    }
    require(total <= 20) { "Общий уровень не может превышать 20." }
    patch("classes", JsonArray(classes))
    patch("lvl", JsonObject(sheet.values["lvl"].objectValue() + ("level" to JsonPrimitive(total))))
}

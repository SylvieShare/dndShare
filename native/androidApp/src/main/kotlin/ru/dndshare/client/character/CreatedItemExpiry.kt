package ru.dndshare.client.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.*

fun expireCreatedItemPatches(sheet: CharacterSheet, uid: String): List<SheetPatch> {
    val entry =
        inventoryInstances(sheet).firstOrNull { it.first.text("uid") == uid }?.first
            ?: error("Предмет больше не существует.")
    val creation = entry["params"].objectValue()["creation"] as? JsonObject ?: return emptyList()
    if (creation["duration"].objectValue().text("kind") == "permanent") return emptyList()
    if (creation.text("on_expire") != "vanish")
        return listOf(
            sheetFieldPatch(
                sheet,
                inventoryInstancePath(sheet, uid) + sheetPath("params", "creation", "expired"),
                JsonPrimitive(creation["expired"] != JsonPrimitive(true)),
            )
        )
    return buildList {
        add(SheetPatch("remove", inventoryInstancePath(sheet, uid)))
        for (raw in sheet.values["items"].objectValue()["sections"].arrayValue()) {
            val section = raw.objectValue()
            if (uid in section["slots"].objectValue())
                add(
                    SheetPatch(
                        path =
                            sheetPath("values", "items", "sections") +
                                sheetSelector("id", section.getValue("id")) +
                                sheetPath("slots"),
                        value = JsonObject(section["slots"].objectValue() - uid),
                    )
                )
        }
    }
}

fun statusDurationLabel(raw: JsonElement?): String {
    val value = raw.objectValue()
    val kind = value.text("kind").ifBlank { "manual" }
    val constant =
        mapOf(
            "manual" to "До ручного снятия",
            "until_rest" to "До отдыха",
            "permanent" to "Постоянно",
        )
    constant[kind]?.let {
        return it
    }
    if (kind == "custom") return value.text("text").ifBlank { "Не указана" }
    val units =
        mapOf(
            "rounds" to listOf("раунд", "раунда", "раундов"),
            "minutes" to listOf("минута", "минуты", "минут"),
            "hours" to listOf("час", "часа", "часов"),
            "days" to listOf("день", "дня", "дней"),
        )[kind] ?: return "Не указана"
    val count = value["value"].number()
    if (count <= 0) return "Не указана"
    val form =
        if (count % 100 in 11..14) 2
        else
            when (count % 10) {
                1 -> 0
                in 2..4 -> 1
                else -> 2
            }
    return "$count ${units[form]}"
}

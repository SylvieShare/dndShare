package ru.dndshare.client.ui.character

import kotlinx.serialization.json.*
import ru.dndshare.client.model.text
import ru.dndshare.client.model.CatalogueItem
import ru.dndshare.client.character.*

internal fun removeHeaderStatusPatches(sheet: CharacterSheet, uid: String, items: Map<Long, CatalogueItem>): List<SheetPatch> {
    val values = sheet.values
    val (field, value) = when (uid) {
        "inspiration" -> "inspiration" to JsonPrimitive(false)
        "exhaustion" -> "exhaustion" to JsonObject(values["exhaustion"].objectValue() + ("level" to JsonPrimitive(0)))
        else -> {
            require(normalizedStatusRows(values["states"].arrayValue()).any { it.text("uid") == uid }) { "Состояние уже снято." }
            val input = buildJsonObject {
                put("statusEdits", buildJsonObject { put(uid, buildJsonObject { put("remove", true) }) })
            }
            return statusFormPatches(initialForm("statuses", sheet).copy(input = input), sheet, items)
        }
    }
    return listOf(SheetPatch(path = sheetPath("values", field), value = value))
}

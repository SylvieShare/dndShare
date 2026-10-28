package ru.dndshare.client.character

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*

/** Only local JSON changes are reversible; server commands and dice receipts stay immutable. */
@Serializable data class SheetHistoryStep(val undo: SheetEdit, val redo: SheetEdit)

fun historyEdit(step: SheetHistoryStep, document: JsonObject, forward: Boolean): SheetEdit {
    val edit = if (forward) step.redo else step.undo
    for ((patch, guard) in edit.patches.zip(edit.before)) {
        val actual = sheetValue(document, patch.path)
        fun compared(value: JsonElement?): JsonElement? =
            if (patch.op == "order" && value is JsonArray)
                JsonArray(value.map { it.jsonObject.getValue(requireNotNull(patch.idField)) })
            else value
        require(
            (actual != null) == guard.exists &&
                compared(actual) == compared(guard.value.takeIf { guard.exists })
        ) {
            "Данные изменились после этой операции; отмена не перезаписывает новые правки."
        }
    }
    return createSheetEdit(
        document,
        edit.patches,
        listOf(buildJsonObject { put("action", if (forward) "redo" else "undo") }),
    )
}

fun sheetHistoryStep(document: JsonObject, patches: List<SheetPatch>): SheetHistoryStep {
    var current = document
    val inverses = mutableListOf<SheetPatch>()
    for (patch in patches) {
        val previous = sheetValue(current, patch.path)
        val reverse =
            when (patch.op) {
                "insert" -> SheetPatch("remove", patch.path)
                "remove" -> {
                    require(previous != null) { "Удалённое значение недоступно для отмены." }
                    val selector = patch.path.last() as? JsonObject
                    if (selector == null) SheetPatch(path = patch.path, value = previous)
                    else {
                        val field = selector.getValue("idField").jsonPrimitive.content
                        val rows = sheetValue(current, patch.path.dropLast(1))!!.jsonArray
                        val index = rows.indexOfFirst { it.jsonObject[field] == selector["id"] }
                        SheetPatch(
                            "insert",
                            patch.path,
                            previous,
                            beforeId = rows.getOrNull(index + 1)?.jsonObject?.get(field),
                        )
                    }
                }
                "order" ->
                    SheetPatch(
                        "order",
                        patch.path,
                        JsonArray(
                            previous!!.jsonArray.map {
                                it.jsonObject.getValue(requireNotNull(patch.idField))
                            }
                        ),
                        idField = patch.idField,
                    )
                "set" ->
                    if (previous == null) SheetPatch("remove", patch.path)
                    else SheetPatch(path = patch.path, value = previous)
                else -> error("Неизвестная операция документа.")
            }
        current = applySheetPatches(current, listOf(patch))
        inverses.add(0, reverse)
    }
    return SheetHistoryStep(createSheetEdit(current, inverses), createSheetEdit(document, patches))
}

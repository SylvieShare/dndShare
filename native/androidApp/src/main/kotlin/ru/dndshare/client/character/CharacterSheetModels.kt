package ru.dndshare.client.character

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import ru.dndshare.client.model.text

@Serializable
data class CharacterSheet(
    val templateName: String, val userId: Long, val data: JsonObject, val version: Long,
    val publicVisible: Boolean = false, val sourceId: Long = 0, val sourceName: String = "",
    val sourceVersionId: Long? = null, val sourceVersion: String = "", val iconImageUrl: String? = null,
) {
    val values get() = data["values"] as? JsonObject ?: JsonObject(emptyMap())
    val name get() = values.text(if (templateName == "VTM20") "char_name" else "name").ifBlank { "Без имени" }
    val portrait get() = (values["ava"] as? JsonObject)?.text("url")?.takeIf { it.isNotBlank() }
}

@Serializable
data class SheetPatch(val op: String = "set", val path: List<JsonElement>, val value: JsonElement = JsonNull,
    val idField: String? = null, val beforeId: JsonElement? = null)

@Serializable
data class SheetPrecondition(val path: List<JsonElement>, val exists: Boolean, val value: JsonElement = JsonNull)

@Serializable
data class SheetEdit(val id: String, val patches: List<SheetPatch>, val before: List<SheetPrecondition>)

@Serializable
data class SheetPacket(val baseVersion: Long, val mutationId: String, val patches: List<SheetPatch>)

@Serializable
data class SheetDraft(val edits: List<SheetEdit> = emptyList(), val sending: SheetPacket? = null,
    val blocked: String? = null)

@Serializable
data class SheetChange(val fromVersion: Long, val version: Long, val mutationId: String? = null,
    val patches: List<SheetPatch> = emptyList())

data class SheetSnapshot(val sheet: CharacterSheet, val draft: SheetDraft) {
    val document get() = draft.edits.fold(sheet.data) { data, edit -> applySheetPatches(data, edit.patches) }
    val displayed get() = sheet.copy(data = document)
}

fun sheetPath(vararg keys: String): List<JsonElement> = keys.map(::JsonPrimitive)

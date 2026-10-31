package ru.dndshare.client.ui.character

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

@Serializable
data class SheetItemDestination(
    val id: Long,
    val spellKey: String? = null,
    val equipmentUid: String? = null,
)

@Serializable
data class SheetNavigationState(
    val version: Int = 1,
    val sectionName: String = "",
    val overlay: String? = null,
    val itemStack: List<SheetItemDestination> = emptyList(),
    val discardDialog: Boolean = false,
)

/** Upgrade the saved UI state at its boundary; runtime destinations have one typed owner. */
internal fun decodeSheetNavigation(encoded: String): SheetNavigationState = runCatching {
    val raw = WireJson.parseToJsonElement(encoded).jsonObject
    val version = raw["version"].number()
    val current =
        when (version) {
            0 -> {
                val keys = raw["itemSpellKeys"].arrayValue()
                val destinations =
                    raw["itemStack"].arrayValue().mapIndexedNotNull { index, id ->
                        id.referenceId()
                            ?.takeIf { it > 0 }
                            ?.let {
                                buildJsonObject {
                                    put("id", it)
                                    (keys.getOrNull(index) as? JsonPrimitive)
                                        ?.contentOrNull
                                        ?.takeIf(String::isNotBlank)
                                        ?.let { key -> put("spellKey", key) }
                                }
                            }
                    }
                JsonObject(
                    raw - "itemSpellKeys" +
                        mapOf("version" to JsonPrimitive(1), "itemStack" to JsonArray(destinations))
                )
            }
            1 -> raw
            else -> error("Unsupported navigation state")
        }
    WireJson.decodeFromJsonElement<SheetNavigationState>(current)
}
    .getOrElse { SheetNavigationState() }

internal fun SheetNavigationState.pushItem(id: Long, spellKey: String? = null) =
    copy(itemStack = itemStack + SheetItemDestination(id, spellKey?.takeIf(String::isNotBlank)))

internal fun SheetNavigationState.popItem() = copy(itemStack = itemStack.dropLast(1))

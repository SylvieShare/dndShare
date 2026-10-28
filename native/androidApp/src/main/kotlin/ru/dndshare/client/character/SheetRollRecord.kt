package ru.dndshare.client.character

import kotlinx.serialization.Serializable

/** Room owns roll payloads. SavedState keeps navigation and small preferences only. */
@Serializable
data class SheetRollRecord(
    val id: String,
    val request: SheetRollRequest,
    val result: SheetRollResult,
    val prepared: PreparedD20Roll? = null,
    val triggers: List<RollTriggerAction> = emptyList(),
    val reroll: Boolean = false,
    val completedAt: Long,
    val eventId: Long? = null,
    val sessionUuid: String? = null,
) {
    fun actions(): List<RollTriggerAction> =
        if (reroll || prepared == null) emptyList()
        else
            triggers.filter {
                it.event == "any" || it.event == "natural_one" && result.selected == 1
            }

    companion object {
        const val SECTION = "dice-result"
    }
}

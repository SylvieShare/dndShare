package ru.dndshare.client.ui.character

import ru.dndshare.client.character.*

data class SheetDiceNotice(
    val id: String,
    val request: SheetRollRequest,
    val mode: String,
    val result: SheetRollResult?,
    val busy: Boolean,
    val error: String?,
    val actions: List<RollTriggerAction>,
    val completedAt: Long,
)

data class SheetRollUiState(
    val request: SheetRollRequest? = null,
    val mode: String = "auto",
    val result: SheetRollResult? = null,
    val busy: Boolean = false,
    val error: String? = null,
    val recordId: String = "",
    val actions: List<RollTriggerAction> = emptyList(),
    val completedAt: Long = 0,
    val notices: List<SheetDiceNotice> = emptyList(),
)

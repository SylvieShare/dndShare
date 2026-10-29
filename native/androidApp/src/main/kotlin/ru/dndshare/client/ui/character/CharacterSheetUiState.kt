package ru.dndshare.client.ui.character

import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.character.SheetSnapshot

data class SheetJournalState(
    val payload: JsonObject? = null,
    val loading: Boolean = false,
    val error: String? = null,
)

data class CharacterSheetUiState(
    val snapshot: SheetSnapshot? = null,
    val content: SheetContentState = SheetContentState(),
    val navigation: SheetNavigationState = SheetNavigationState(),
    val editor: SheetEditorState? = null,
    val restoringEditor: Boolean = false,
    val loadError: String? = null,
    val connecting: Boolean = false,
    val saveMessage: String? = null,
    val journal: SheetJournalState = SheetJournalState(),
    val remote: SheetRemoteState = SheetRemoteState(),
    val campaign: SheetCampaignState = SheetCampaignState(),
    val roll: SheetRollUiState = SheetRollUiState(),
    val commands: ru.dndshare.client.character.CharacterCommandState =
        ru.dndshare.client.character.CharacterCommandState(),
) {
    val sheet
        get() = snapshot?.displayed
}

internal data class SheetServices(
    val synchronize: suspend (Long) -> Unit,
    val refreshJournal: suspend () -> Unit,
    val api: ru.dndshare.client.network.ApiClient? = null,
    val sources: List<ru.dndshare.client.model.GameSource> = emptyList(),
    val icons: ru.dndshare.client.character.InventoryIconCache? = null,
)

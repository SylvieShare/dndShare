package ru.dndshare.client.ui.character

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import ru.dndshare.client.character.SheetSnapshot

@Serializable
data class SheetNavigationState(
    val sectionName: String = "", val overlay: String? = null,
    val itemStack: List<Long> = emptyList(), val discardDialog: Boolean = false,
)

data class SheetJournalState(val payload: JsonObject? = null, val loading: Boolean = false, val error: String? = null)

data class CharacterSheetUiState(
    val snapshot: SheetSnapshot? = null,
    val content: SheetContentState = SheetContentState(),
    val navigation: SheetNavigationState = SheetNavigationState(),
    val editor: SheetEditorState? = null,
    val restoringEditor: Boolean = false,
    val loadError: String? = null,
    val saveMessage: String? = null,
    val journal: SheetJournalState = SheetJournalState(),
) {
    val sheet get() = snapshot?.displayed
}

internal data class SheetServices(val synchronize: suspend (Long) -> Unit, val refreshJournal: suspend () -> Unit)

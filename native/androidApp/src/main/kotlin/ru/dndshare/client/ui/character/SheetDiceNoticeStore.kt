package ru.dndshare.client.ui.character

import java.util.UUID

/**
 * Presentation history is bounded, survives rotation in the ViewModel, and owns no game mutations.
 */
internal class SheetDiceNoticeStore {
    private val rows = linkedMapOf<String, SheetDiceNotice>()
    private val dismissed = linkedSetOf<String>()

    fun row(id: String) = rows[id]

    fun dismiss(id: String) {
        rows.remove(id)
        dismissed.add(id)
        while (dismissed.size > 128) dismissed.remove(dismissed.first())
    }

    fun mode(id: String, value: String) {
        rows[id]?.let { rows[id] = it.copy(mode = value) }
    }

    fun update(
        input: SheetRollUiState,
        consumed: Set<String>,
        rejected: Set<Pair<String, String>>,
    ): SheetRollUiState {
        var state = input
        val request = state.request
        if (request != null) {
            val id = state.recordId.ifBlank { UUID.randomUUID().toString() }
            val old = rows[id]
            state = state.copy(recordId = id)
            if (id !in dismissed) {
                val complete =
                    state.completedAt.takeIf { it > 0 }
                        ?: old?.completedAt?.takeIf { it > 0 }
                        ?: if (!state.busy && (state.result != null || state.error != null))
                            System.currentTimeMillis()
                        else 0
                rows[id] =
                    SheetDiceNotice(
                        id,
                        request,
                        state.mode,
                        state.result,
                        state.busy,
                        state.error,
                        state.actions,
                        complete,
                    )
            }
        }
        while (rows.size > 5) dismiss(rows.keys.first())
        val notices =
            rows.values.map { row ->
                row.copy(
                    actions =
                        if (row.id in consumed) emptyList()
                        else row.actions.filter { (row.id to it.key) !in rejected }
                )
            }
        return state.copy(notices = notices)
    }
}

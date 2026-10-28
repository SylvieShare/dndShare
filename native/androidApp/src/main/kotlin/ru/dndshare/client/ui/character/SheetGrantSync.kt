package ru.dndshare.client.ui.character

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import ru.dndshare.client.character.*

/** Reconcile grants after remote edits as well as native forms, once all owners are cached. */
internal fun CoroutineScope.synchronizeSheetGrants(
    uuid: String,
    accountId: Long,
    sheets: CharacterSheetRepository,
    snapshot: StateFlow<SheetSnapshot?>,
    content: StateFlow<SheetContentState>,
) = launch {
    combine(snapshot, content) { sheet, data -> sheet?.displayed to data }
        .collect { (sheet, data) ->
            if (sheet == null || sheet.userId != accountId) return@collect
            val latest = sheets.local(uuid)?.displayed ?: return@collect
            if (latest.data != sheet.data) return@collect
            val requirements = featRequirementPatches(latest, data.items, data.metadata)
            val projected = latest.copy(data = applySheetPatches(latest.data, requirements))
            val patches = requirements + abilitySpellGrantPatches(projected, data.items)
            if (patches.isNotEmpty())
                try {
                    sheets.enqueue(uuid, patches, latest.data, recordHistory = false)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    /* Durable document remains unchanged; the next snapshot retries. */
                }
        }
}

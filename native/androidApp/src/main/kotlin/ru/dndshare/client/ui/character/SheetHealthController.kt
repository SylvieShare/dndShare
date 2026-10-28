package ru.dndshare.client.ui.character

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import ru.dndshare.client.character.*

internal class SheetHealthController(
    private val uuid: String,
    private val accountId: Long,
    private val sheets: CharacterSheetRepository,
) {
    private val mutex = Mutex()

    suspend fun deathSave(key: String, index: Int): String? =
        try {
            mutex.withLock {
                val sheet = requireNotNull(sheets.local(uuid)).displayed
                require(sheet.userId == accountId) { "Этот лист доступен только для просмотра." }
                val next = deathSaveChange(sheet.values["hp"].objectValue(), key, index)
                // Guard the complete health object: a later remote healing must never be
                // overwritten.
                sheets.enqueue(
                    uuid,
                    listOf(SheetPatch(path = sheetPath("values", "hp"), value = next)),
                    sheet.data,
                )
            }
            null
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            error.message ?: "Не удалось изменить спасброски от смерти."
        }
}

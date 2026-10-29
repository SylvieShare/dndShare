package ru.dndshare.client.ui.character

import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.encodeToString
import ru.dndshare.client.character.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*

internal data class LiveStatContext(
    val items: Map<Long, CatalogueItem>,
    val metadata: HandbookMetadata,
    val session: String?,
)

internal enum class LiveStatResult {
    Saved,
    Invalid,
    Failed,
}

/** Serial local commits; server delivery remains the durable repository outbox's responsibility. */
internal class SheetLiveStats(
    private val uuid: String,
    private val cache: CharacterSheetDao,
    private val sheets: CharacterSheetRepository,
    scope: CoroutineScope,
    private val dispatcher: CoroutineDispatcher,
    private val current: () -> SheetEditorState?,
    private val context: () -> LiveStatContext?,
    private val awaitInput: suspend () -> Unit,
    private val publish: (SheetEditorState) -> Unit,
) {
    private val requests = Channel<Unit>(Channel.CONFLATED)
    private val gate = Mutex()

    init {
        scope.launch {
            for (request in requests) {
                delay(120)
                while (requests.tryReceive().isSuccess) {}
                flush()
            }
        }
    }

    fun supports(editor: SheetEditorState) =
        editor.baseline.templateName == "DND5" &&
            dndAbilities.any { it.id == editor.fields.target } &&
            context() != null

    suspend fun discard(block: suspend () -> Unit) = gate.withLock { block() }

    fun request() {
        requests.trySend(Unit)
    }

    suspend fun flush(): LiveStatResult = gate.withLock {
        val editor = current() ?: return@withLock LiveStatResult.Saved
        if (!supports(editor)) return@withLock LiveStatResult.Saved
        val data = context() ?: return@withLock LiveStatResult.Failed
        val initial = initialForm(editor.fields.target, editor.baseline, data.items, data.session)
        if (
            editor.fields.copy(id = "", error = null, diskInputs = false) ==
                initial.copy(id = "", error = null, diskInputs = false)
        )
            return@withLock LiveStatResult.Saved
        awaitInput()
        val prepared =
            try {
                withContext(dispatcher) {
                    val patches =
                        formPatches(editor.fields, editor.baseline, data.items, data.metadata)
                    val projected =
                        editor.baseline.copy(
                            data = applySheetPatches(editor.baseline.data, patches)
                        )
                    val all = patches + abilitySpellGrantPatches(projected, data.items)
                    all to editor.baseline.copy(data = applySheetPatches(editor.baseline.data, all))
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                report(editor, error.message ?: "Проверьте введённые значения.")
                return@withLock LiveStatResult.Invalid
            }
        try {
            val (patches, baseline) = prepared
            sheets.enqueue(
                uuid,
                patches,
                editor.baseline.data,
                metadata =
                    formSessionMetadata(
                        editor.fields,
                        editor.baseline,
                        patches,
                        data.items,
                        data.session,
                    ),
                liveForm =
                    CachedSheetForm(uuid, editor.fields.id, WireJson.encodeToString(baseline)),
            )
            current()
                ?.takeIf { it.fields.id == editor.fields.id }
                ?.let {
                    publish(
                        it.copy(
                            baseline = baseline,
                            fields =
                                it.fields.copy(
                                    error =
                                        if (
                                            it.fields.copy(error = null) ==
                                                editor.fields.copy(error = null)
                                        )
                                            null
                                        else it.fields.error
                                ),
                        )
                    )
                }
            LiveStatResult.Saved
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            report(editor, error.message ?: "Не удалось сохранить изменения на устройстве.")
            LiveStatResult.Failed
        }
    }

    private fun report(editor: SheetEditorState, message: String) {
        current()
            ?.takeIf {
                it.fields.id == editor.fields.id &&
                    it.fields.copy(error = null) == editor.fields.copy(error = null)
            }
            ?.let {
                if (it.fields.error != message)
                    publish(it.copy(fields = it.fields.copy(error = message)))
            }
    }
}

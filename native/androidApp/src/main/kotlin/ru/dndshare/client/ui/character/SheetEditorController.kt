package ru.dndshare.client.ui.character

import androidx.lifecycle.SavedStateHandle
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.encodeToString
import ru.dndshare.client.character.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*

/** Small input state goes into saved state; the immutable document stays in Room. */
internal class SheetEditorController(
    private val uuid: String, private val accountId: Long,
    private val saved: SavedStateHandle, private val cache: CharacterSheetDao,
    private val sheets: CharacterSheetRepository, private val scope: CoroutineScope,
    private val workDispatcher: CoroutineDispatcher = Dispatchers.Default,
) {
    private val mutable = MutableStateFlow<SheetEditorState?>(null)
    val state = mutable.asStateFlow()
    private val loading = MutableStateFlow(saved.get<String>(KEY) != null)
    val restoring = loading.asStateFlow()
    private val failures = MutableStateFlow<String?>(null)
    val error = failures.asStateFlow()
    private var operation: Job? = null

    init {
        operation = scope.launch {
            try {
                val encoded = saved.get<String>(KEY) ?: return@launch
                val fields = WireJson.decodeFromString<SheetFormFields>(encoded)
                val row = cache.form(uuid, fields.id)
                if (row == null) saved[KEY] = null // Accepted/cancelled before the process died.
                else {
                    val baseline = withContext(workDispatcher) { WireJson.decodeFromString<CharacterSheet>(row.baseline) }
                    require(baseline.userId == accountId)
                    mutable.value = SheetEditorState(fields, baseline)
                }
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { failures.value = "Не удалось восстановить форму. Откройте редактирование заново." }
            finally { loading.value = false }
        }
    }

    fun open(target: String, baseline: CharacterSheet) {
        if (loading.value || operation?.isActive == true || baseline.userId != accountId) return
        operation = scope.launch {
            loading.value = true
            try {
                val fields = initialForm(target, baseline)
                val encoded = withContext(workDispatcher) { WireJson.encodeToString(baseline) }
                cache.putForm(CachedSheetForm(uuid, fields.id, encoded))
                failures.value = null
                persist(SheetEditorState(fields, baseline))
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { failures.value = "Не удалось сохранить исходные значения формы." }
            finally { loading.value = false }
        }
    }

    private fun persist(editor: SheetEditorState) {
        saved[KEY] = WireJson.encodeToString(editor.fields)
        mutable.value = editor
    }

    private fun change(transform: (SheetFormFields) -> SheetFormFields) {
        val current = mutable.value ?: return
        if (!current.saving) persist(current.copy(fields = transform(current.fields).copy(error = null)))
    }

    fun number(field: SheetNumberField, text: String) = change { fields -> when (field) {
        SheetNumberField.Current -> fields.copy(number = text)
        SheetNumberField.Temporary -> fields.copy(temp = text)
        SheetNumberField.Maximum -> fields.copy(maximum = text)
        SheetNumberField.Exhaustion -> fields.copy(exhaustion = text)
    } }
    fun inspiration(value: Boolean) = change { it.copy(inspiration = value) }
    fun status(id: Long, selected: Boolean) = change { it.copy(selected = if (selected) (it.selected + id).distinct() else it.selected - id) }

    fun dismiss() {
        val current = mutable.value ?: return
        if (current.saving || operation?.isActive == true) return
        operation = scope.launch {
            try {
                cache.removeForm(uuid, current.fields.id)
                saved[KEY] = null
                mutable.value = null
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { persist(current.copy(fields = current.fields.copy(error = "Не удалось закрыть форму. Повторите попытку."))) }
        }
    }

    fun submit(items: Map<Long, CatalogueItem>) {
        val current = mutable.value ?: return
        if (current.saving || operation?.isActive == true) return
        val patches = runCatching { formPatches(current.fields, current.baseline, items) }.getOrElse {
            persist(current.copy(fields = current.fields.copy(error = it.message)))
            return
        }
        mutable.value = current.copy(saving = true)
        operation = scope.launch {
            try {
                // Accepting into the durable outbox and consuming the form is atomic.
                sheets.enqueue(uuid, patches, current.baseline.data, current.fields.id)
                saved[KEY] = null
                mutable.value = null
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (error: Exception) { persist(current.copy(fields = current.fields.copy(error = error.message))) }
        }
    }

    companion object { const val KEY = "sheet.form.inputs" }
}

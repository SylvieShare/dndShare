package ru.dndshare.client.ui.character

import androidx.lifecycle.SavedStateHandle
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*
import ru.dndshare.client.network.uploadCharacterImage

/** Small input state goes into saved state; the immutable document stays in Room. */
internal class SheetEditorController(
    private val uuid: String,
    private val accountId: Long,
    private val saved: SavedStateHandle,
    private val cache: CharacterSheetDao,
    private val sheets: CharacterSheetRepository,
    private val scope: CoroutineScope,
    private val workDispatcher: CoroutineDispatcher = Dispatchers.Default,
) {
    private val mutable = MutableStateFlow<SheetEditorState?>(null)
    val state = mutable.asStateFlow()
    private val loading = MutableStateFlow(true)
    val restoring = loading.asStateFlow()
    private val failures = MutableStateFlow<String?>(null)
    val error = failures.asStateFlow()
    private var operation: Job? = null
    private val persistence = Mutex()
    private var inputWrite: Job? = null

    init {
        operation = scope.launch {
            try {
                val encoded =
                    saved.get<String>(KEY)
                        ?: cache
                            .openForms()
                            .lastOrNull { it.uuid == uuid && it.inputs != "{}" }
                            ?.inputs
                        ?: return@launch
                var fields =
                    withContext(workDispatcher) {
                        WireJson.decodeFromString<SheetFormFields>(encoded)
                    }
                val row = cache.form(uuid, fields.id)
                if (row == null) saved[KEY] = null // Accepted/cancelled before the process died.
                else {
                    if (fields.diskInputs)
                        fields =
                            withContext(workDispatcher) {
                                WireJson.decodeFromString<SheetFormFields>(row.inputs)
                            }
                    val baseline =
                        withContext(workDispatcher) {
                            WireJson.decodeFromString<CharacterSheet>(row.baseline)
                        }
                    require(baseline.userId == accountId)
                    val waiting =
                        cache.pendingCommands().any { command ->
                            command.uuid == uuid &&
                                runCatching {
                                        WireJson.parseToJsonElement(command.payload)
                                            .jsonObject
                                            .text("formId") == fields.id
                                    }
                                    .getOrDefault(false)
                        }
                    mutable.value = SheetEditorState(fields, baseline, commandPending = waiting)
                    saved[KEY] =
                        if (encoded.length <= 8_000) encoded
                        else
                            WireJson.encodeToString(
                                fields.copy(input = JsonObject(emptyMap()), diskInputs = true)
                            )
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                failures.value = "Не удалось восстановить форму. Откройте редактирование заново."
            } finally {
                loading.value = false
            }
        }
    }

    fun open(
        target: String,
        baseline: CharacterSheet,
        items: Map<Long, CatalogueItem> = emptyMap(),
        sessionUuid: String? = null,
        seedInput: JsonObject? = null,
    ) {
        if (loading.value || operation?.isActive == true || baseline.userId != accountId) return
        operation = scope.launch {
            loading.value = true
            try {
                val initial = initialForm(target, baseline, items, sessionUuid)
                val fields = if (seedInput == null) initial else initial.copy(input = seedInput)
                val encoded = withContext(workDispatcher) { WireJson.encodeToString(baseline) }
                cache.putForm(CachedSheetForm(uuid, fields.id, encoded))
                failures.value = null
                persist(SheetEditorState(fields, baseline))
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                failures.value = "Не удалось сохранить исходные значения формы."
            } finally {
                loading.value = false
            }
        }
    }

    private fun persist(editor: SheetEditorState) {
        val encoded = WireJson.encodeToString(editor.fields)
        saved[KEY] =
            if (encoded.length <= 8_000) encoded
            else
                WireJson.encodeToString(
                    editor.fields.copy(input = JsonObject(emptyMap()), diskInputs = true)
                )
        mutable.value = editor
        inputWrite?.cancel()
        inputWrite = scope.launch {
            try {
                persistence.withLock {
                    cache.updateFormInputs(uuid, editor.fields.id, encoded)
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                failures.value =
                    "Не удалось сохранить ввод на устройстве. Не закрывайте форму и повторите сохранение."
            }
        }
    }

    private fun change(transform: (SheetFormFields) -> SheetFormFields) {
        val current = mutable.value ?: return
        if (!current.saving && !current.commandPending)
            persist(current.copy(fields = transform(current.fields).copy(error = null)))
    }

    fun number(field: SheetNumberField, text: String) = change { fields ->
        when (field) {
            SheetNumberField.Current -> fields.copy(number = text)
            SheetNumberField.Temporary -> fields.copy(temp = text)
            SheetNumberField.Maximum -> fields.copy(maximum = text)
            SheetNumberField.Exhaustion -> fields.copy(exhaustion = text)
        }
    }

    fun calculateHealth(kind: String, expression: String, items: Map<Long, CatalogueItem>) {
        val current = mutable.value ?: return
        try {
            change { healthCalculation(it, current.baseline, items, kind, expression) }
        } catch (error: Exception) {
            persist(current.copy(fields = current.fields.copy(error = error.message)))
        }
    }

    fun inspiration(value: Boolean) = change { it.copy(inspiration = value) }

    fun input(key: String, value: JsonElement) = change {
        it.copy(input = JsonObject(it.input + (key to value)))
    }

    fun status(id: Long, selected: Boolean) = change {
        it.copy(selected = if (selected) (it.selected + id).distinct() else it.selected - id)
    }

    fun dismiss() {
        val current = mutable.value ?: return
        if (current.saving || operation?.isActive == true) return
        operation = scope.launch {
            try {
                inputWrite?.join()
                cache.removeForm(uuid, current.fields.id)
                saved[KEY] = null
                mutable.value = null
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                persist(
                    current.copy(
                        fields =
                            current.fields.copy(
                                error = "Не удалось закрыть форму. Повторите попытку."
                            )
                    )
                )
            }
        }
    }

    fun submit(
        items: Map<Long, CatalogueItem>,
        sessionUuid: String? = null,
        metadata: ru.dndshare.client.model.HandbookMetadata =
            ru.dndshare.client.model.HandbookMetadata(),
    ) {
        val current = mutable.value ?: return
        if (current.saving || operation?.isActive == true) return
        mutable.value = current.copy(saving = true)
        operation = scope.launch {
            try {
                inputWrite?.join()
                val patches =
                    withContext(workDispatcher) {
                        val changes = formPatches(current.fields, current.baseline, items, metadata)
                        val projected =
                            current.baseline.copy(
                                data = applySheetPatches(current.baseline.data, changes)
                            )
                        changes + abilitySpellGrantPatches(projected, items)
                    }

                // Accepting into the durable outbox and consuming the form is atomic.
                val metadata =
                    formSessionMetadata(
                        current.fields,
                        current.baseline,
                        patches,
                        items,
                        sessionUuid,
                    )
                sheets.enqueue(uuid, patches, current.baseline.data, current.fields.id, metadata)
                saved[KEY] = null
                mutable.value = null
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                persist(current.copy(fields = current.fields.copy(error = error.message)))
            }
        }
    }

    fun submitImage(api: ru.dndshare.client.network.ApiClient, queue: CharacterCommandQueue?) {
        val current = mutable.value ?: return
        if (current.saving || operation?.isActive == true) return
        mutable.value = current.copy(saving = true)
        operation = scope.launch {
            var working = current
            try {
                inputWrite?.join()
                val remove = current.fields.input["remove"] == JsonPrimitive(true)
                val path = current.fields.input["path"]?.jsonPrimitive?.content.orEmpty()
                if (
                    !remove && path.isBlank() && current.fields.input.text("originalPath").isBlank()
                ) {
                    cache.removeForm(uuid, current.fields.id)
                    saved[KEY] = null
                    mutable.value = null
                    return@launch
                }
                require(remove || path.isNotBlank()) { "Примените обрезку выбранного изображения." }
                if (current.fields.target == "icon") {
                    requireNotNull(queue)
                        .send(
                            "media-icon",
                            buildJsonObject {
                                put("remove", remove)
                                if (!remove) put("path", path)
                            },
                            true,
                            current.fields.id,
                        )
                } else {
                    val uploaded =
                        if (remove) JsonNull
                        else
                            (current.fields.input["uploaded"] as? JsonObject)
                                ?: api.uploadCharacterImage(java.io.File(path)).also { reply ->
                                    working =
                                        current.copy(
                                            fields =
                                                current.fields.copy(
                                                    input =
                                                        JsonObject(
                                                            current.fields.input +
                                                                ("uploaded" to reply)
                                                        )
                                                )
                                        )
                                    persist(working.copy(saving = true))
                                    inputWrite?.join()
                                }
                    val portrait =
                        if (uploaded is JsonObject)
                            JsonObject(uploaded.filterKeys { it in setOf("url", "upload_id") })
                        else uploaded
                    val patch = SheetPatch(path = sheetPath("values", "ava"), value = portrait)
                    sheets.enqueue(uuid, listOf(patch), current.baseline.data, current.fields.id)
                }
                saved[KEY] = null
                mutable.value = null
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                persist(working.copy(fields = working.fields.copy(error = error.message)))
            }
        }
    }

    fun commandState(value: CharacterCommandState) {
        val current = mutable.value ?: return
        if (
            !(isCommandForm(current.fields.target) || current.fields.target == "icon") ||
                current.fields.id != value.formId
        )
            return
        mutable.value = current.copy(commandPending = value.pending, commandBusy = value.busy)
        if (!value.pending && value.result != null) {
            saved[KEY] = null
            mutable.value = null
        }
    }

    fun submitCommand(
        queue: CharacterCommandQueue,
        items: Map<Long, CatalogueItem>,
        metadata: HandbookMetadata = HandbookMetadata(),
    ) {
        val current = mutable.value ?: return
        if (current.saving || current.commandBusy || operation?.isActive == true) return
        val command = runCatching {
            commandSpec(current.fields, current.baseline, items, metadata)
        }
            .getOrElse {
                persist(current.copy(fields = current.fields.copy(error = it.message)))
                return
            }
        mutable.value = current.copy(saving = true)
        operation = scope.launch {
            try {
                inputWrite?.join()
                if (cache.form(uuid, current.fields.id) == null) {
                    saved[KEY] = null
                    mutable.value = null
                    return@launch
                }
                queue.send(
                    command.route,
                    command.intent,
                    command.changesDocument,
                    current.fields.id,
                )
                saved[KEY] = null
                mutable.value = null
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                if (mutable.value?.fields?.id == current.fields.id)
                    persist(
                        current.copy(
                            commandPending =
                                queue.state.value.pending &&
                                    queue.state.value.formId == current.fields.id,
                            commandBusy =
                                queue.state.value.busy &&
                                    queue.state.value.formId == current.fields.id,
                            fields = current.fields.copy(error = error.message),
                        )
                    )
            }
        }
    }

    companion object {
        const val KEY = "sheet.form.inputs"
    }
}

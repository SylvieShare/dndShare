package ru.dndshare.client.ui.maps

import androidx.compose.runtime.*
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*

@Stable
internal class MapReferenceController(private val workspace: MapEditorWorkspace) {
    var saving by mutableStateOf(false)
        private set

    var error by mutableStateOf<String?>(null)
        private set

    var status by mutableStateOf<String?>(null)
        private set

    var confirmDiscard by mutableStateOf(false)
        private set

    var reloading by mutableStateOf(false)
        private set

    var selectedPoint by mutableIntStateOf(-1)
    var selectedSlot by mutableIntStateOf(-1)
    var activeField by mutableStateOf<String?>(null)
    private var pending: (() -> Unit)? = null
    val draft
        get() = workspace.ui.reference

    val currentDraft
        get() = workspace.currentUi.reference

    val model
        get() = workspace.models.find { it.uuid == draft?.modelId }

    fun request(action: () -> Unit) {
        if (saving) return
        if (currentDraft?.dirty == true) {
            pending = action
            confirmDiscard = true
        } else action()
    }

    fun discard() {
        confirmDiscard = false
        val action = pending
        pending = null
        action?.invoke()
    }

    fun keep() {
        confirmDiscard = false
        pending = null
    }

    fun choose(model: MapModel) {
        if (model.uuid == currentDraft?.modelId) return
        request { load(model) }
    }

    private fun load(model: MapModel) {
        workspace.controller.ui {
            it.copy(reference = MapReferenceDraft(model.uuid, editableMapModel(model)))
        }
        selectedPoint = -1
        selectedSlot = -1
        activeField = null
        error = null
        status = null
    }

    fun reset() {
        currentDraft?.let { draft ->
            workspace.controller.ui {
                it.copy(
                    reference =
                        draft.copy(
                            current = draft.base,
                            invalidNumbers = emptyMap(),
                            blockers =
                                (draft.base["blockers"] ?: JsonArray(emptyList())).toString(),
                        )
                )
            }
        }
        error = null
        status = null
    }

    fun kind(value: String) {
        request { workspace.controller.ui { it.copy(referenceKind = value, reference = null) } }
    }

    fun set(key: String, value: JsonElement) {
        if (saving) return
        workspace.controller.ui { ui ->
            ui.copy(
                reference =
                    ui.reference?.let {
                        it.copy(current = it.current.with(key, value))
                    }
            )
        }
        status = null
    }

    fun objectField(group: String, key: String, value: JsonElement) {
        val row = currentDraft?.current?.get(group) as? JsonObject ?: buildJsonObject {}
        set(group, row.with(key, value))
    }

    fun validateNumber(label: String, text: String, integer: Boolean): Boolean {
        val parsed = text.replace(',', '.').toDoubleOrNull()
        val valid = parsed?.isFinite() == true && (!integer || text.toIntOrNull() != null)
        workspace.controller.ui { ui ->
            ui.copy(
                reference =
                    ui.reference?.let { draft ->
                        draft.copy(
                            invalidNumbers =
                                if (valid) draft.invalidNumbers - label
                                else draft.invalidNumbers + (label to text)
                        )
                    }
            )
        }
        return valid
    }

    fun number(key: String, value: String) {
        if (key in setOf("width", "height", "wallMask"))
            value.toIntOrNull()?.let { set(key, JsonPrimitive(it)) }
        else
            value
                .replace(',', '.')
                .toDoubleOrNull()
                ?.takeIf { it.isFinite() }
                ?.let {
                    set(key, JsonPrimitive(it))
                    if (key == "mountDepth" && it == 0.0) set("mountProfile", JsonPrimitive(""))
                }
    }

    fun collection(value: String) {
        request {
            workspace.controller.ui { it.copy(collection = value) }
            workspace.current.models
                .firstOrNull {
                    !it.hidden &&
                        it.isObject == (workspace.currentUi.referenceKind == "object") &&
                        it.collection == value
                }
                ?.let(::load)
        }
    }

    fun listField(list: String, index: Int, key: String, value: JsonElement) {
        val rows = currentDraft?.current?.rows(list)?.toMutableList() ?: return
        if (index !in rows.indices) return
        rows[index] = rows[index].with(key, value)
        set(list, JsonArray(rows))
    }

    fun add(list: String, value: JsonObject) {
        set(list, JsonArray(currentDraft?.current?.rows(list).orEmpty() + value))
    }

    fun remove(list: String, index: Int) {
        set(
            list,
            JsonArray(
                currentDraft?.current?.rows(list).orEmpty().filterIndexed { i, _ -> i != index }
            ),
        )
        removeNumberRow(list, index)
        selectedPoint = -1
        selectedSlot = -1
    }

    private fun removeNumberRow(list: String, index: Int) {
        workspace.controller.ui { ui ->
            ui.copy(
                reference =
                    ui.reference?.let { draft ->
                        val prefix = "$list/"
                        draft.copy(
                            invalidNumbers =
                                draft.invalidNumbers
                                    .mapNotNull { (key, value) ->
                                        if (!key.startsWith(prefix)) key to value
                                        else {
                                            val rest = key.removePrefix(prefix)
                                            val row = rest.substringBefore('/').toIntOrNull()
                                            when {
                                                row == null -> key to value
                                                row == index -> null
                                                row > index ->
                                                    "$prefix${row-1}/${rest.substringAfter('/')}" to
                                                        value
                                                else -> key to value
                                            }
                                        }
                                    }
                                    .toMap()
                        )
                    }
            )
        }
    }

    fun removeBehaviourRow(list: String, index: Int) {
        val rows = (currentDraft?.current?.get("behaviour") as? JsonObject)?.rows(list).orEmpty()
        behaviour(list, JsonArray(rows.filterIndexed { i, _ -> i != index }))
        removeNumberRow(list, index)
    }

    fun behaviour(key: String, value: JsonElement) {
        objectField("behaviour", key, value)
    }

    fun behaviourRow(list: String, index: Int, key: String, value: JsonElement) {
        val row = currentDraft?.current?.get("behaviour") as? JsonObject ?: return
        val rows = row.rows(list).toMutableList()
        if (index !in rows.indices) return
        rows[index] = rows[index].with(key, value)
        behaviour(list, JsonArray(rows))
    }

    fun reload() {
        if (reloading || saving) return
        request {
            reloading = true
            error = null
            workspace.scope.launch {
                try {
                    val id = currentDraft?.modelId
                    val models = workspace.controller.refreshModels()
                    val fresh = models.firstOrNull { it.uuid == id }
                    if (fresh != null) load(fresh)
                    else {
                        workspace.controller.ui { it.copy(reference = null) }
                        status = "Модель больше недоступна в справочнике"
                    }
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (failure: Exception) {
                    error = failure.message ?: "Не удалось обновить справочник"
                } finally {
                    reloading = false
                }
            }
        }
    }

    fun save() {
        if (saving || currentDraft?.dirty != true) return
        val snapshot = currentDraft ?: return
        val original = workspace.current.models.find { it.uuid == snapshot.modelId } ?: return
        saving = true
        error = null
        status = null
        workspace.scope.launch {
            try {
                val payload = withContext(Dispatchers.Default) { snapshot.payload() }
                val saved = workspace.api.updateModel(original, payload)
                workspace.controller.adoptModel(saved)
                load(saved)
                status = "Параметры сохранены"
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (failure: Exception) {
                error = failure.message ?: "Не удалось сохранить модель"
            } finally {
                saving = false
            }
        }
    }
}

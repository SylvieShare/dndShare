package ru.dndshare.client.ui.character

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.network.*

data class SheetRemoteState(
    val busy: Boolean = false,
    val error: String? = null,
    val history: List<JsonObject> = emptyList(),
    val historyLoaded: Boolean = false,
    val historyMore: Boolean = true,
    val destination: String? = null,
    val deleted: Boolean = false,
    val sessions: List<CharacterSession> = emptyList(),
    val sessionUuid: String? = null,
)

internal class SheetRemoteController(
    private val uuid: String,
    private val services: SheetServices,
    private val sheets: CharacterSheetRepository,
    private val scope: CoroutineScope,
) {
    private val mutable = MutableStateFlow(SheetRemoteState())
    val state = mutable.asStateFlow()
    val sources
        get() = services.sources

    fun seedSessions(sessions: List<CharacterSession>) {
        mutable.update {
            it.copy(
                sessions = sessions,
                sessionUuid =
                    it.sessionUuid?.takeIf { id -> sessions.any { row -> row.uuid == id } }
                        ?: sessions.firstOrNull()?.uuid,
            )
        }
    }

    fun selectSession(uuid: String) {
        if (mutable.value.sessions.any { it.uuid == uuid })
            mutable.update { it.copy(sessionUuid = uuid) }
    }

    private var lastSessionsAt = 0L

    suspend fun loadSessions() {
        val api = services.api ?: return
        val response = api.characterRequest(uuid, "sessions")
        seedSessions(
            response["sessions"]?.jsonArray.orEmpty().map { WireJson.decodeFromJsonElement(it) }
        )
        lastSessionsAt = System.currentTimeMillis()
    }

    private fun run(block: suspend (ApiClient) -> Unit) {
        if (mutable.value.busy) return
        mutable.update { it.copy(busy = true, error = null) }
        scope.launch {
            try {
                block(requireNotNull(services.api))
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutable.update {
                    it.copy(
                        error =
                            error.message ?: "Не удалось выполнить запрос. Проверьте соединение."
                    )
                }
            } finally {
                mutable.update { it.copy(busy = false) }
            }
        }
    }

    fun openCharacter(uuid: String) {
        mutable.update { it.copy(destination = uuid) }
    }

    fun visibility(visible: Boolean) = run { api ->
        sheets.awaitSaved(uuid)
        api.setCharacterPublic(uuid, visible)
        sheets.refresh(uuid)
    }

    fun edition(editionId: Long) = run { api ->
        val sheet = sheets.awaitSaved(uuid)
        api.changeCharacterEdition(uuid, editionId, sheet.version)
        sheets.refresh(uuid)
    }

    fun clone() = run { api ->
        sheets.awaitSaved(uuid)
        val destination = api.cloneCharacter(uuid)
        mutable.update { it.copy(destination = destination) }
    }

    fun delete() = run { api ->
        sheets.awaitSaved(uuid)
        api.deleteCharacter(uuid)
        mutable.update { it.copy(deleted = true) }
    }

    fun history(more: Boolean = false) = run { api ->
        val old = if (more) mutable.value.history else emptyList()
        val before = old.lastOrNull()?.get("id")?.jsonPrimitive?.longOrNull
        val page =
            api.characterHistory(uuid, before)["changes"]?.jsonArray.orEmpty().map { it.jsonObject }
        mutable.update {
            it.copy(
                history = (old + page).distinctBy { row -> row["id"] },
                historyLoaded = true,
                historyMore = page.size == 50,
            )
        }
    }

    suspend fun poll() {
        val api = services.api ?: return
        val local = sheets.local(uuid) ?: return
        if (api.characterVersion(uuid) != local.sheet.version) sheets.refresh(uuid)
        if (lastSessionsAt > 0 && System.currentTimeMillis() - lastSessionsAt > 60_000)
            loadSessions()
    }
}

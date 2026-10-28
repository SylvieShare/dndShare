package ru.dndshare.client.ui.character

import io.ktor.http.HttpMethod
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import ru.dndshare.client.character.CharacterCommandQueue
import ru.dndshare.client.model.text
import ru.dndshare.client.network.*

/** Player-facing session operations; game mutations use the durable command queue. */
internal class CharacterCampaignController(
    private val uuid: String,
    private val api: ApiClient?,
    private val commands: CharacterCommandQueue?,
    private val scope: CoroutineScope,
) {
    private val mutable = MutableStateFlow(SheetCampaignState())
    val state = mutable.asStateFlow()
    private var generation = 0
    private var loader: Job? = null
    private var lastRosterAt = 0L
    private var requestSerial = 0L

    fun bind(session: String?) {
        if (mutable.value.sessionUuid == session) return
        generation++
        lastRosterAt = 0
        loader?.cancel()
        mutable.value = SheetCampaignState(sessionUuid = session)
        refresh()
    }

    fun refresh() {
        loader?.cancel()
        loader = scope.launch { reload() }
    }

    suspend fun reload() {
        val api = api ?: return
        val current = mutable.value
        val token = generation
        val serial = ++requestSerial
        mutable.update { it.copy(loading = true, error = null) }
        try {
            val response = api.characterRequest(uuid, "concentration")
            var players = current.players
            var transfers = emptyList<JsonObject>()
            var pending = emptyList<JsonObject>()
            val session = current.sessionUuid
            if (session != null) {
                if (players.isEmpty() || System.currentTimeMillis() - lastRosterAt > 60_000) {
                    players =
                        api.session(session)["participants"]?.jsonArray.orEmpty().map {
                            it.jsonObject
                        }
                    lastRosterAt = System.currentTimeMillis()
                }
                transfers =
                    api.characterRequest(uuid, "item-transfers")["transfers"]
                        ?.jsonArray
                        .orEmpty()
                        .map { it.jsonObject }
                pending =
                    api.characterRequest(uuid, "interactions?sessionUuid=$session")["events"]
                        ?.jsonArray
                        .orEmpty()
                        .map { it.jsonObject }
            }
            if (token != generation || serial != requestSerial) return
            mutable.update {
                it.copy(
                    players = players,
                    transfers = transfers,
                    pending = pending,
                    concentration = response["concentration"] as? JsonObject,
                )
            }
            if (current.peer != null) conversation(older = false)
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            if (token == generation)
                mutable.update {
                    it.copy(error = error.message ?: "Не удалось обновить события сессии.")
                }
        } finally {
            if (token == generation) mutable.update { it.copy(loading = false) }
        }
    }

    fun openPeer(peer: String) {
        generation++
        mutable.update {
            it.copy(peer = peer, conversation = emptyList(), hasMore = false, error = null)
        }
        scope.launch { conversation() }
    }

    fun closePeer() {
        generation++
        mutable.update { it.copy(peer = null, conversation = emptyList()) }
    }

    fun older() {
        scope.launch { conversation(older = true) }
    }

    private suspend fun conversation(older: Boolean = false) {
        val api = api ?: return
        val current = mutable.value
        val session = current.sessionUuid ?: return
        val peer = current.peer ?: return
        val token = generation
        val oldest =
            if (older) current.conversation.firstOrNull()?.get("id")?.jsonPrimitive?.longOrNull
            else null
        val query =
            "interactions?sessionUuid=$session&peer=$peer" + (oldest?.let { "&before=$it" } ?: "")
        try {
            val reply = api.characterRequest(uuid, query)
            val page = reply["events"]?.jsonArray.orEmpty().map { it.jsonObject }
            if (token != generation) return
            val history =
                (mutable.value.conversation + page)
                    .associateBy { it["id"] }
                    .values
                    .sortedBy { it["id"]?.jsonPrimitive?.longOrNull ?: 0 }
            mutable.update {
                it.copy(
                    conversation = history,
                    hasMore =
                        if (older || current.conversation.isEmpty())
                            reply["hasMore"] == JsonPrimitive(true)
                        else it.hasMore,
                )
            }
            val through = history.lastOrNull()?.get("id")?.jsonPrimitive?.longOrNull ?: return
            api.characterRequest(
                uuid,
                "interactions/read",
                HttpMethod.Post,
                buildJsonObject {
                    put("sessionUuid", session)
                    put("peerUuid", peer)
                    put("throughId", through)
                },
            )
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            if (token == generation) mutable.update { it.copy(error = error.message) }
        }
    }

    private fun command(route: String, body: JsonObject, changesDocument: Boolean) {
        if (mutable.value.busy) return
        mutable.update { it.copy(busy = true, error = null) }
        scope.launch {
            try {
                requireNotNull(commands).send(route, body, changesDocument)
                if (route == "interactions" && body.text("type") == "chat_message")
                    mutable.update { it.copy(messagesSent = it.messagesSent + 1) }
                reload()
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Exception) {
                mutable.update {
                    it.copy(error = error.message ?: "Не удалось выполнить действие.")
                }
            } finally {
                mutable.update { it.copy(busy = false) }
            }
        }
    }

    fun message(text: String) {
        val current = mutable.value
        val message = text.trim()
        if (message.isEmpty() || message.codePointCount(0, message.length) > 2000) {
            mutable.update { it.copy(error = "Сообщение: от 1 до 2000 символов.") }
            return
        }
        command(
            "interactions",
            buildJsonObject {
                put("sessionUuid", current.sessionUuid ?: return)
                put("recipientCharUuid", current.peer ?: return)
                put("type", "chat_message")
                put("message", message)
            },
            false,
        )
    }

    fun challenge() {
        val current = mutable.value
        command(
            "interactions",
            buildJsonObject {
                put("sessionUuid", current.sessionUuid ?: return)
                put("recipientCharUuid", current.peer ?: return)
                put("type", "rps_challenge")
            },
            false,
        )
    }

    fun resolveInteraction(id: Long, decision: String) =
        command("interactions/$id/resolve", buildJsonObject { put("decision", decision) }, false)

    fun resolveTransfer(id: Long, decision: String) =
        command("item-transfers/$id/resolve", buildJsonObject { put("decision", decision) }, true)

    fun endConcentration() {
        val held = mutable.value.concentration ?: return
        command(
            "concentration",
            buildJsonObject {
                put("spellId", 0)
                put("endId", held.text("id"))
            },
            true,
        )
    }
}

data class SheetCampaignState(
    val sessionUuid: String? = null,
    val loading: Boolean = false,
    val busy: Boolean = false,
    val error: String? = null,
    val players: List<JsonObject> = emptyList(),
    val transfers: List<JsonObject> = emptyList(),
    val pending: List<JsonObject> = emptyList(),
    val peer: String? = null,
    val conversation: List<JsonObject> = emptyList(),
    val hasMore: Boolean = false,
    val messagesSent: Int = 0,
    val concentration: JsonObject? = null,
)

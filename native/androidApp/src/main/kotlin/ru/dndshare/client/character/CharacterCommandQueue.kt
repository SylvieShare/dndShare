package ru.dndshare.client.character

import java.util.UUID
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.network.ApiException

@Serializable
private data class StoredCharacterCommand(
    val route: String,
    val intent: JsonObject,
    val body: JsonObject? = null,
    val changesDocument: Boolean,
    val formId: String? = null,
    val presentation: JsonObject? = null,
)

data class CharacterCommandState(
    val busy: Boolean = false,
    val pending: Boolean = false,
    val message: String? = null,
    val formId: String? = null,
    val result: JsonObject? = null,
)

/** Durable immutable command for server-side spells, transfers and interactions. */
class CharacterCommandQueue(
    private val uuid: String,
    private val cache: CharacterSheetDao,
    private val sheets: CharacterSheetRepository,
    private val execute: suspend (String, JsonObject) -> JsonObject,
    private val scope: CoroutineScope,
) {
    private val mutex = Mutex()
    private val mutable = MutableStateFlow(CharacterCommandState())
    val state: StateFlow<CharacterCommandState> = mutable.asStateFlow()
    private var retry: Job? = null

    private suspend fun stored(): StoredCharacterCommand? {
        val payload = cache.observeSection(uuid, SECTION).first() ?: return null
        return if (payload == "{}") null else WireJson.decodeFromString(payload)
    }

    private suspend fun save(command: StoredCharacterCommand) {
        cache.putSection(CachedSheetSection(uuid, SECTION, WireJson.encodeToString(command)))
        mutable.update { it.copy(pending = true, formId = command.formId) }
    }

    suspend fun send(
        route: String,
        intent: JsonObject,
        changesDocument: Boolean = true,
        formId: String? = null,
        presentation: JsonObject? = null,
    ): JsonObject {
        try {
            return mutex.withLock {
                require(
                    route.matches(
                        Regex(
                            "(?:dice-roll|session-d20/[a-fA-F0-9-]+|session-event/[a-fA-F0-9-]+|journal|media-icon|spell-cast|spell-use|usable-use|concentration|money-transfers|item-transfers(?:/[0-9]+/resolve)?|interactions(?:/(?:read|[0-9]+/resolve))?)"
                        )
                    )
                )
                require(presentation == null || route == "dice-roll")
                val previous = stored()
                if (previous != null)
                    require(previous.route == route && previous.intent == intent) {
                        "Предыдущий запрос ещё не подтверждён. Повторите его, прежде чем отправлять другой."
                    }
                if (previous == null)
                    requireNotNull(sheets.local(uuid)) { "Сначала загрузите лист персонажа." }
                val command =
                    previous
                        ?: StoredCharacterCommand(
                                route,
                                intent,
                                changesDocument = changesDocument,
                                formId = formId,
                                presentation = presentation,
                            )
                            .also { save(it) }
                perform(command)
            }
        } finally {
            if (mutable.value.pending) resume()
        }
    }

    private suspend fun perform(original: StoredCharacterCommand): JsonObject {
        var command = original
        mutable.update {
            it.copy(
                busy = true,
                pending = true,
                message = null,
                formId = command.formId,
                result = null,
            )
        }
        try {
            if (command.body == null) {
                val sheet = if (command.changesDocument) sheets.awaitSaved(uuid) else null
                command =
                    command
                        .copy(
                            body =
                                JsonObject(
                                    command.intent +
                                        buildJsonObject {
                                            put("clientActionId", UUID.randomUUID().toString())
                                            if (command.changesDocument)
                                                put("version", requireNotNull(sheet).version)
                                        }
                                )
                        )
                        .also { save(it) }
            }
            val reply = execute(command.route, requireNotNull(command.body))
            // The acknowledgement and consumption of the form commit together.
            val receipt =
                if (command.route == "dice-roll" && command.presentation != null) {
                    val context = command.presentation
                    val record =
                        SheetRollRecord(
                            id = context.getValue("id").jsonPrimitive.content,
                            request = WireJson.decodeFromJsonElement(context.getValue("request")),
                            result = WireJson.decodeFromJsonElement(reply.getValue("roll")),
                            prepared =
                                WireJson.decodeFromJsonElement(command.intent.getValue("prepared")),
                            triggers =
                                context["triggers"]?.let {
                                    WireJson.decodeFromJsonElement<List<RollTriggerAction>>(it)
                                } ?: emptyList(),
                            reroll = context["reroll"] == JsonPrimitive(true),
                            completedAt = System.currentTimeMillis(),
                            eventId = reply["eventId"]?.jsonPrimitive?.longOrNull,
                            sessionUuid =
                                command.intent["sessionUuid"]?.jsonPrimitive?.contentOrNull,
                        )
                    CachedSheetSection(
                        uuid,
                        SheetRollRecord.SECTION,
                        WireJson.encodeToString(record),
                    )
                } else null
            cache.acceptCommand(CachedSheetSection(uuid, SECTION, "{}"), command.formId, receipt)
            mutable.update { it.copy(pending = false, result = reply) }
            if (command.changesDocument) {
                try {
                    sheets.refresh(uuid)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    mutable.update {
                        it.copy(
                            message = "Запрос принят. Лист обновится после восстановления связи."
                        )
                    }
                }
            }
            return reply
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (error: Exception) {
            val rejected =
                error is ApiException &&
                    error.status in 400..499 &&
                    error.status !in setOf(401, 429)
            if (rejected) {
                cache.putSection(CachedSheetSection(uuid, SECTION, "{}"))
                mutable.update { it.copy(pending = false, message = error.message) }
                if (command.changesDocument) {
                    try {
                        sheets.refresh(uuid)
                    } catch (cancelled: CancellationException) {
                        throw cancelled
                    } catch (_: Exception) {
                        /* A definite rejection remains available to the UI. */
                    }
                }
            } else
                mutable.update {
                    it.copy(
                        pending = true,
                        message =
                            "Подтверждение не получено. Запрос сохранён и будет повторён без повторного расхода ресурсов.",
                    )
                }
            throw error
        } finally {
            mutable.update { it.copy(busy = false) }
        }
    }

    fun resume() {
        if (retry?.isActive == true) return
        retry = scope.launch {
            delay(1_000)
            var delayMillis = 1_000L
            while (isActive) {
                try {
                    mutex.withLock { stored()?.let { perform(it) } ?: return@launch }
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (_: Exception) {
                    val remains =
                        try {
                            stored() != null
                        } catch (cancelled: CancellationException) {
                            throw cancelled
                        } catch (_: Exception) {
                            mutable.update {
                                it.copy(
                                    message =
                                        "Не удалось прочитать сохранённый запрос. Данные остаются на устройстве."
                                )
                            }
                            return@launch
                        }
                    if (!remains) break
                    delay(delayMillis)
                    delayMillis = (delayMillis * 2).coerceAtMost(30_000)
                }
            }
        }
    }

    companion object {
        const val SECTION = "remote-command"
    }
}

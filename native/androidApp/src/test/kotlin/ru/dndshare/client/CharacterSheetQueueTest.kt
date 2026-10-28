package ru.dndshare.client

import java.io.IOException
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*
import ru.dndshare.client.network.ApiException

@OptIn(ExperimentalCoroutinesApi::class)
class CharacterSheetQueueTest {
    private class MemorySheets : CharacterSheetDao {
        val rows = MutableStateFlow<Map<String, CachedCharacterSheet>>(emptyMap())
        val forms = mutableMapOf<String, CachedSheetForm>()

        override suspend fun form(uuid: String, id: String) = forms[uuid]?.takeIf { it.id == id }

        override suspend fun openForms() = forms.values.toList()

        override suspend fun updateFormInputs(uuid: String, id: String, inputs: String): Int {
            val current = forms[uuid]?.takeIf { it.id == id } ?: return 0
            forms[uuid] = current.copy(inputs = inputs)
            return 1
        }

        override suspend fun putForm(form: CachedSheetForm) {
            forms[form.uuid] = form
        }

        override suspend fun removeForm(uuid: String, id: String) {
            if (forms[uuid]?.id == id) forms.remove(uuid)
        }

        override fun observeSection(uuid: String, section: String): Flow<String?> = flowOf(null)

        override suspend fun putSection(section: CachedSheetSection) = Unit

        override suspend fun pendingCommands(): List<CachedSheetSection> = emptyList()

        override fun observe(uuid: String): Flow<CachedCharacterSheet?> = rows.map { it[uuid] }

        override suspend fun get(uuid: String) = rows.value[uuid]

        override suspend fun pending() =
            rows.value.values.filter { it.draft != "{}" }.map { it.uuid }

        override suspend fun put(sheet: CachedCharacterSheet) {
            rows.value = rows.value + (sheet.uuid to sheet)
        }
    }

    private class Server : CharacterSheetApi {
        var sheet =
            CharacterSheet(
                "DND5",
                1,
                WireJson.parseToJsonElement("""{"values":{"hp":{"current":10},"name":"Лира"}}""")
                    .jsonObject,
                1,
            )
        var loseResponse = false
        var pause: CompletableDeferred<Unit>? = null
        val packets = mutableListOf<SheetPacket>()
        val accepted = mutableMapOf<String, Pair<SheetPacket, SheetChange>>()

        override suspend fun character(uuid: String) = sheet

        override suspend fun saveCharacter(uuid: String, packet: SheetPacket): SheetChange {
            packets += packet
            pause?.await()
            accepted[packet.mutationId]?.let { (original, receipt) ->
                assertEquals(original, packet)
                return receipt
            }
            if (packet.baseVersion != sheet.version) throw ApiException(409, "CONFLICT", "Conflict")
            val reply =
                SheetChange(sheet.version, sheet.version + 1, packet.mutationId, packet.patches)
            sheet =
                sheet.copy(
                    data = applySheetPatches(sheet.data, packet.patches),
                    version = reply.version,
                )
            accepted[packet.mutationId] = packet to reply
            if (loseResponse) {
                loseResponse = false
                throw IOException("Connection lost after commit")
            }
            return reply
        }

        fun remote(path: List<JsonElement>, value: JsonElement) {
            sheet =
                sheet.copy(
                    version = sheet.version + 1,
                    data =
                        applySheetPatches(
                            sheet.data,
                            listOf(SheetPatch(path = path, value = value)),
                        ),
                )
        }
    }

    private fun hp(value: Int) =
        listOf(
            SheetPatch(path = sheetPath("values", "hp", "current"), value = JsonPrimitive(value))
        )

    @Test
    fun lostAcknowledgementRetriesTheExactImmutablePacket() = runTest {
        val server = Server()
        val cache = MemorySheets()
        val repository = CharacterSheetRepository(server, cache, 1, backgroundScope)
        repository.refresh("test")
        server.loseResponse = true
        repository.enqueue("test", hp(7))
        runCurrent()
        advanceTimeBy(501)
        runCurrent()
        assertEquals(1, server.accepted.size)
        assertEquals(2, server.packets.size)
        assertEquals(server.packets[0], server.packets[1])
        assertTrue(assertNotNull(repository.observe("test").first()).draft.edits.isEmpty())
        assertEquals(
            JsonPrimitive(7),
            sheetValue(server.sheet.data, sheetPath("values", "hp", "current")),
        )
    }

    @Test
    fun anEditDuringAnInFlightSaveIsSentAfterItsAcknowledgement() = runTest {
        val server = Server()
        val cache = MemorySheets()
        val repository = CharacterSheetRepository(server, cache, 1, backgroundScope)
        repository.refresh("test")
        server.pause = CompletableDeferred()
        repository.enqueue("test", hp(9))
        runCurrent()
        repository.enqueue("test", hp(6))
        runCurrent()
        assertEquals(1, server.packets.size)
        server.pause!!.complete(Unit)
        runCurrent()
        assertEquals(listOf(1L, 2L), server.packets.map { it.baseVersion })
        assertEquals(
            JsonPrimitive(6),
            sheetValue(server.sheet.data, sheetPath("values", "hp", "current")),
        )
        assertTrue(assertNotNull(repository.observe("test").first()).draft.edits.isEmpty())
    }

    @Test
    fun unrelatedRemoteChangesRebaseButAConflictingValueStaysLocal() = runTest {
        val server = Server()
        val cache = MemorySheets()
        val repository = CharacterSheetRepository(server, cache, 1, backgroundScope)
        repository.refresh("test")
        server.remote(sheetPath("values", "name"), JsonPrimitive("Торин"))
        repository.enqueue("test", hp(8))
        runCurrent()
        assertEquals("Торин", server.sheet.name)
        assertEquals(
            JsonPrimitive(8),
            sheetValue(server.sheet.data, sheetPath("values", "hp", "current")),
        )
        server.remote(sheetPath("values", "hp", "current"), JsonPrimitive(3))
        repository.enqueue("test", hp(5))
        runCurrent()
        val conflict = assertNotNull(repository.observe("test").first())
        assertNotNull(conflict.draft.blocked)
        assertEquals(
            JsonPrimitive(5),
            sheetValue(conflict.document, sheetPath("values", "hp", "current")),
        )
        assertEquals(
            JsonPrimitive(3),
            sheetValue(server.sheet.data, sheetPath("values", "hp", "current")),
        )
    }

    @Test
    fun restorationDoesNotResendAnAlreadyAcknowledgedMutationAsANewAction() = runTest {
        val server = Server()
        val cache = MemorySheets()
        val firstScope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        val original = CharacterSheetRepository(server, cache, 1, firstScope)
        original.refresh("test")
        server.loseResponse = true
        original.enqueue("test", hp(4))
        runCurrent()
        original.closeAndJoin()
        val restored = CharacterSheetRepository(server, cache, 1, backgroundScope)
        restored.resume()
        runCurrent()
        assertEquals(1, server.accepted.size)
        assertEquals(server.packets.first(), server.packets.last())
        assertTrue(assertNotNull(restored.observe("test").first()).draft.edits.isEmpty())
    }

    @Test
    fun anotherUsersSheetNeverProducesAPacket() = runTest {
        val server = Server()
        val cache = MemorySheets()
        server.sheet = server.sheet.copy(userId = 2)
        val repository = CharacterSheetRepository(server, cache, 1, backgroundScope)
        repository.refresh("test")
        runCurrent()
        assertFailsWith<IllegalArgumentException> { repository.enqueue("test", hp(1)) }
        assertTrue(server.packets.isEmpty())
    }

    @Test
    fun retryKeepsSessionEventsInTheSameDurablePacket() = runTest {
        val server = Server()
        val cache = MemorySheets()
        val repository = CharacterSheetRepository(server, cache, 1, backgroundScope)
        repository.refresh("test")
        val metadata =
            listOf(
                buildJsonObject {
                    put(
                        "events",
                        buildJsonArray {
                            add(
                                buildJsonObject {
                                    put("sessionUuid", "11111111-1111-4111-8111-111111111111")
                                    put("type", "rest_completed")
                                    put("action", "Короткий отдых")
                                    put("clientActionId", "22222222-2222-4222-8222-222222222222")
                                    put("data", JsonObject(emptyMap()))
                                }
                            )
                        },
                    )
                }
            )
        server.loseResponse = true
        repository.enqueue("test", hp(6), metadata = metadata)
        runCurrent()
        advanceTimeBy(501)
        runCurrent()
        assertEquals(1, server.accepted.size)
        assertEquals(metadata, server.packets.first().metadata)
        assertEquals(server.packets.first(), server.packets.last())
        assertTrue(requireNotNull(repository.local("test")).draft.edits.isEmpty())
    }

    @Test
    fun undoSurvivesAcknowledgementRefreshAndRepositoryRecreation() = runTest {
        val server = Server()
        val cache = MemorySheets()
        var repository = CharacterSheetRepository(server, cache, 1, backgroundScope)
        repository.refresh("test")
        repository.enqueue("test", hp(7))
        runCurrent()
        repository = CharacterSheetRepository(server, cache, 1, backgroundScope)
        server.remote(sheetPath("values", "name"), JsonPrimitive("Торин"))
        repository.refresh("test")
        repository.history("test")
        runCurrent()
        assertEquals(
            JsonPrimitive(10),
            sheetValue(server.sheet.data, sheetPath("values", "hp", "current")),
        )
        assertEquals(
            JsonPrimitive("Торин"),
            sheetValue(server.sheet.data, sheetPath("values", "name")),
        )
        assertTrue(repository.local("test")!!.draft.redo.isNotEmpty())
        repository.history("test", forward = true)
        runCurrent()
        assertEquals(
            JsonPrimitive(7),
            sheetValue(server.sheet.data, sheetPath("values", "hp", "current")),
        )
        assertEquals(
            listOf("undo", "redo"),
            server.packets.takeLast(2).map {
                it.metadata.single()["action"]!!.jsonPrimitive.content
            },
        )
    }

    @Test
    fun undoBehindAnInFlightSaveKeepsTheFrozenPacketAndRefusesLaterRemoteConflicts() = runTest {
        val server = Server()
        val cache = MemorySheets()
        val repository = CharacterSheetRepository(server, cache, 1, backgroundScope)
        repository.refresh("test")
        server.pause = CompletableDeferred()
        repository.enqueue("test", hp(7))
        runCurrent()
        val frozen = repository.local("test")!!.draft.sending
        repository.history("test")
        assertEquals(frozen, repository.local("test")!!.draft.sending)
        assertEquals(2, repository.local("test")!!.draft.edits.size)
        server.pause!!.complete(Unit)
        runCurrent()
        assertEquals(
            JsonPrimitive(10),
            sheetValue(server.sheet.data, sheetPath("values", "hp", "current")),
        )
        server.remote(sheetPath("values", "hp", "current"), JsonPrimitive(4))
        repository.refresh("test")
        assertFailsWith<IllegalArgumentException> { repository.history("test", forward = true) }
        assertEquals(
            JsonPrimitive(4),
            sheetValue(server.sheet.data, sheetPath("values", "hp", "current")),
        )
        assertTrue(repository.local("test")!!.draft.redo.isNotEmpty())
        repository.enqueue("test", hp(5))
        runCurrent()
        assertTrue(repository.local("test")!!.draft.redo.isEmpty())
    }
}

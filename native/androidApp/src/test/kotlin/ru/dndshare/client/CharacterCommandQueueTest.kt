package ru.dndshare.client

import java.io.IOException
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.test.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.network.ApiException

@OptIn(ExperimentalCoroutinesApi::class)
class CharacterCommandQueueTest {
    private class Commands : CharacterSheetDao {
        val documents = MutableStateFlow<Map<String, CachedCharacterSheet>>(emptyMap())
        val sections = MutableStateFlow<Map<Pair<String, String>, CachedSheetSection>>(emptyMap())
        val forms = mutableMapOf<Pair<String, String>, CachedSheetForm>()

        override fun observe(uuid: String) = documents.map { it[uuid] }

        override suspend fun get(uuid: String) = documents.value[uuid]

        override suspend fun put(sheet: CachedCharacterSheet) {
            documents.value += sheet.uuid to sheet
        }

        override suspend fun pending() =
            documents.value.values.filter { it.draft != "{}" }.map { it.uuid }

        override fun observeSection(uuid: String, section: String) = sections.map {
            it[uuid to section]?.payload
        }

        override suspend fun putSection(section: CachedSheetSection) {
            sections.value += (section.uuid to section.section) to section
        }

        override suspend fun form(uuid: String, id: String) = forms[uuid to id]

        override suspend fun updateFormInputs(uuid: String, id: String, inputs: String): Int {
            val current = forms[uuid to id] ?: return 0
            forms[uuid to id] = current.copy(inputs = inputs)
            return 1
        }

        override suspend fun updateFormBaseline(uuid: String, id: String, baseline: String): Int {
            val current = forms[uuid to id]?.takeIf { it.id == id } ?: return 0
            forms[uuid to id] = current.copy(baseline = baseline)
            return 1
        }

        override suspend fun putForm(form: CachedSheetForm) {
            forms[form.uuid to form.id] = form
        }

        override suspend fun removeForm(uuid: String, id: String) {
            forms.remove(uuid to id)
        }

        override suspend fun openForms() = forms.values.toList()

        override suspend fun pendingCommands() =
            sections.value.values.filter {
                it.section == CharacterCommandQueue.SECTION && it.payload != "{}"
            }
    }

    private val intent = buildJsonObject {
        put("spellId", 1)
        put("entryKey", "spell:one")
        put("spendSlot", true)
    }

    @Test
    fun lostAcknowledgementReplaysTheFrozenCommandAndConsumesItsFormExactlyOnce() = runTest {
        val cache = Commands()
        val api = SheetStateServer()
        val sheets = CharacterSheetRepository(api, cache, 1, backgroundScope)
        sheets.refresh("hero")
        cache.putForm(CachedSheetForm("hero", "form", "baseline"))
        var spent = 0
        var lose = true
        val requests = mutableListOf<JsonObject>()
        val receipts = mutableMapOf<String, JsonObject>()
        val queue =
            CharacterCommandQueue(
                "hero",
                cache,
                sheets,
                { _, body ->
                    requests += body
                    val key = body.getValue("clientActionId").jsonPrimitive.content
                    receipts[key]?.let {
                        return@CharacterCommandQueue it
                    }
                    spent++
                    val result = buildJsonObject { put("ok", true) }
                    receipts[key] = result
                    if (lose) {
                        lose = false
                        throw IOException("Lost response")
                    }
                    result
                },
                backgroundScope,
            )
        assertFailsWith<IOException> { queue.send("spell-cast", intent, formId = "form") }
        runCurrent()
        if (queue.state.value.pending) queue.send("spell-cast", intent, formId = "form")
        runCurrent()
        assertEquals(1, spent)
        assertTrue(requests.size >= 2)
        assertEquals(requests.first(), requests.last())
        assertNull(cache.form("hero", "form"))
        assertEquals("{}", cache.observeSection("hero", CharacterCommandQueue.SECTION).first())
    }

    @Test
    fun anotherIntentCannotReplaceAnUnconfirmedCommand() = runTest {
        val cache = Commands()
        val api = SheetStateServer()
        val sheets = CharacterSheetRepository(api, cache, 1, backgroundScope)
        sheets.refresh("hero")
        val queue =
            CharacterCommandQueue(
                "hero",
                cache,
                sheets,
                { _, _ -> throw IOException("Offline") },
                backgroundScope,
            )
        assertFailsWith<IOException> { queue.send("spell-cast", intent) }
        assertFailsWith<IllegalArgumentException> {
            queue.send("spell-cast", JsonObject(intent + ("spellId" to JsonPrimitive(2))))
        }
        assertTrue(queue.state.value.pending)
    }

    @Test
    fun definiteRejectionKeepsTheInputFormAndAllowsANewVersionedAttempt() = runTest {
        val cache = Commands()
        val api = SheetStateServer()
        val sheets = CharacterSheetRepository(api, cache, 1, backgroundScope)
        sheets.refresh("hero")
        cache.putForm(CachedSheetForm("hero", "form", "baseline"))
        val queue =
            CharacterCommandQueue(
                "hero",
                cache,
                sheets,
                { _, _ -> throw ApiException(409, "CONFLICT", "Лист изменился") },
                backgroundScope,
            )
        assertFailsWith<ApiException> { queue.send("spell-cast", intent, formId = "form") }
        assertNotNull(cache.form("hero", "form"))
        assertFalse(queue.state.value.pending)
        assertEquals("{}", cache.observeSection("hero", CharacterCommandQueue.SECTION).first())
    }

    @Test
    fun diceReceiptIsPublishedOnlyAfterAcknowledgementAndSurvivesTheSameRetry() = runTest {
        val cache = Commands()
        val api = SheetStateServer()
        val sheets = CharacterSheetRepository(api, cache, 1, backgroundScope)
        sheets.refresh("hero")
        val request = SheetRollRequest("Атака", "attack", bonus = 3)
        val prepared = PreparedD20Roll(request, "normal", 3, emptyList(), 0, emptyList())
        val roll = resolvePreparedD20(prepared, listOf(12))
        val presentation = buildJsonObject {
            put("id", "display-one")
            put("request", WireJson.parseToJsonElement(WireJson.encodeToString(request)))
            put("reroll", true)
        }
        val intent = buildJsonObject {
            put("prepared", WireJson.parseToJsonElement(WireJson.encodeToString(prepared)))
        }
        val receipts = mutableMapOf<String, JsonObject>()
        var calls = 0
        var lose = true
        val queue =
            CharacterCommandQueue(
                "hero",
                cache,
                sheets,
                { route, body ->
                    assertEquals("dice-roll", route)
                    val id = body.getValue("clientActionId").jsonPrimitive.content
                    val reply =
                        receipts.getOrPut(id) {
                            calls++
                            buildJsonObject {
                                put(
                                    "roll",
                                    WireJson.parseToJsonElement(WireJson.encodeToString(roll)),
                                )
                                put("eventId", 42)
                            }
                        }
                    if (lose) {
                        lose = false
                        throw IOException("ack lost")
                    }
                    reply
                },
                backgroundScope,
            )
        assertFailsWith<IOException> {
            queue.send("dice-roll", intent, presentation = presentation)
        }
        assertNull(cache.observeSection("hero", SheetRollRecord.SECTION).first())
        queue.send("dice-roll", intent, presentation = presentation)
        assertEquals(1, calls)
        assertEquals("{}", cache.observeSection("hero", CharacterCommandQueue.SECTION).first())
        val record =
            WireJson.decodeFromString<SheetRollRecord>(
                cache.observeSection("hero", SheetRollRecord.SECTION).first()!!
            )
        assertEquals("display-one", record.id)
        assertEquals(15, record.result.total)
        assertEquals(42L, record.eventId)
        assertTrue(record.reroll)
        assertTrue(record.actions().isEmpty())
    }
}

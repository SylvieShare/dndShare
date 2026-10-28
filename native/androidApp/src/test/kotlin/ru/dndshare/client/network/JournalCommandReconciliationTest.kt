package ru.dndshare.client.network

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.model.WireJson

class JournalCommandReconciliationTest {
    private fun obj(value: String) = WireJson.parseToJsonElement(value).jsonObject

    @Test
    fun exactOrderAcknowledgesReplayButNeverAnUnrelatedOrConcurrentChange() {
        val path = "journals/11111111-1111-1111-1111-111111111111/sections/8/entries/order"
        val journal =
            obj(
                """{"sections":[{"id":8,"events":[{"id":3},{"id":1},{"id":2}]},{"id":9,"events":[]}]}"""
            )
        val body = obj("""{"entryIds":[3,1,2],"expectedEntryIds":[1,2,3]}""")
        assertTrue(journalOrderAlreadyApplied(journal, path, body))
        assertFalse(journalOrderAlreadyApplied(journal, path, obj("""{"entryIds":[1,2,3]}""")))
        assertFalse(journalOrderAlreadyApplied(journal, path, obj("""{"entryIds":[3,1]}""")))
        assertFalse(journalOrderAlreadyApplied(journal, path, obj("""{"entryIds":[3,1,1]}""")))
        assertFalse(
            journalOrderAlreadyApplied(journal, path.replace("sections/8", "sections/7"), body)
        )
        assertFalse(
            journalOrderAlreadyApplied(journal, path.replace("/entries/order", "/entries/8"), body)
        )
        assertTrue(
            journalOrderAlreadyApplied(
                journal,
                path.replace("sections/8", "sections/9"),
                obj("""{"entryIds":[]}"""),
            )
        )
        assertFalse(journalOrderAlreadyApplied(journal, path, obj("""{"entryIds":[3,{},2]}""")))
    }
}

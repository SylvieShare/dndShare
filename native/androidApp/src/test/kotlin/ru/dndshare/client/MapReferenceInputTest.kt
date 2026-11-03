package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.model.WireJson

class MapReferenceInputTest {
    @Test
    fun incompleteNumberSurvivesWorkspacePersistenceAndCannotSaveThePreviousValue() {
        val draft =
            MapReferenceDraft(
                "model",
                buildJsonObject {
                    put("mountDepth", .5)
                    put("blockers", JsonArray(emptyList()))
                },
                invalidNumbers = mapOf("Глубина монтажного основания" to "-"),
            )
        assertTrue(draft.dirty)
        val restored =
            WireJson.decodeFromString<MapReferenceDraft>(
                WireJson.encodeToString(MapReferenceDraft.serializer(), draft)
            )
        assertEquals("-", restored.invalidNumbers["Глубина монтажного основания"])
        assertFailsWith<IllegalArgumentException> { restored.payload() }
        assertEquals(.5, restored.copy(invalidNumbers = emptyMap()).payload().number("mountDepth"))
    }
}

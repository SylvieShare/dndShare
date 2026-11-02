package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.model.WireJson

class MapDocumentTest {
    @Test
    fun movingOneOfAThousandTilesSendsOneSmallEntityPatch() {
        val tiles =
            JsonArray(
                (0 until 1000).map { index ->
                    buildJsonObject {
                        put("id", "tile-$index")
                        put("modelId", "floor")
                        put("x", index % 100)
                        put("y", index / 100)
                        put("level", 0)
                        put("rotation", 0)
                    }
                }
            )
        val before = BattleMap(document = newMapDocument().with("tiles", tiles)).content
        val after =
            before.with(
                "document",
                before
                    .getValue("document")
                    .jsonObject
                    .with(
                        "tiles",
                        JsonArray(
                            tiles.mapIndexed { index, value ->
                                if (index == 501) value.jsonObject.with("x", JsonPrimitive(23))
                                else value
                            }
                        ),
                    ),
            )
        val changes = mapDiff(before, after)
        assertEquals(1, changes.size)
        assertTrue(WireJson.encodeToString(changes).length < 300)
        assertEquals(JsonPrimitive("tile-501"), changes.single().path[2].jsonObject["id"])
        assertEquals(after, mapApply(before, changes))
        assertTrue(WireJson.encodeToString(mapHistory(before, after)).length < 600)
    }

    @Test
    fun entityHistoryPreservesFieldsAddedByTheServerAndRestoresOrdering() {
        val before = json("""{"tiles":[{"id":"a","x":1},{"id":"b","x":2}],"lights":[]}""")
        val after = json("""{"tiles":[{"id":"c","x":3},{"id":"b","x":4}],"lights":[]}""")
        val history = mapHistory(before, after)
        val canonical =
            after.with("lights", JsonArray(listOf(json("""{"id":"new-light","enabled":true}"""))))
        val undone = mapApply(canonical, history.inverse)
        assertEquals(before["tiles"], undone["tiles"])
        assertEquals(canonical["lights"], undone["lights"])
        assertEquals(canonical, mapApply(undone, history.forward))
    }

    private fun json(text: String) = WireJson.parseToJsonElement(text).jsonObject

    @Test
    fun unknownDocumentFieldsSurviveEditingAndAck() {
        val base =
            BattleMap(
                id = "map",
                revision = 3,
                document = json("""{"version":2,"future":{"nested":[1,2]},"tiles":[]} """),
            )
        val edit = base.copy(name = "Комната")
        val packet = MapPacket(3, "stable", mapDiff(base.content, edit.content))
        val work =
            MapWork(
                key = "map",
                confirmed = base,
                current = edit,
                sending = packet,
                sent = edit.content,
            )
        val accepted = mapAcknowledge(work, MapChange(4, patches = packet.patches))
        assertFalse(accepted.dirty)
        assertEquals(base.document, accepted.current.document)
        assertEquals("Комната", accepted.current.name)
    }

    @Test
    fun editsDuringRequestKeepServerCanonicalizationAndNextLocalEdit() {
        val base = BattleMap(id = "map", revision = 3)
        val sent = base.copy(name = "Одна")
        val packet = MapPacket(3, "stable", mapDiff(base.content, sent.content))
        val later = sent.copy(name = "Другая")
        val work =
            MapWork(
                key = "map",
                confirmed = base,
                current = later,
                sending = packet,
                sent = sent.content,
            )
        val server =
            sent.copy(document = JsonObject(sent.document + ("serverField" to JsonPrimitive(true))))
        val accepted =
            mapAcknowledge(work, MapChange(4, patches = mapDiff(base.content, server.content)))
        assertTrue(accepted.dirty)
        assertEquals("Другая", accepted.current.name)
        assertEquals(JsonPrimitive(true), accepted.current.document["serverField"])
        assertEquals(4L, accepted.confirmed.revision)
    }

    @Test
    fun serverSelectorsAreAppliedUsingTheSharedPatchContract() {
        val source = json("""{"tiles":[{"id":"a","x":1},{"id":"b","x":2}]}""")
        val patches =
            WireJson.decodeFromString<List<MapPatch>>(
                """[{"op":"set","path":["tiles",{"idField":"id","id":"b"},"x"],"value":4}]"""
            )
        val next = mapApply(source, patches)
        assertEquals(1, next["tiles"]!!.jsonArray[0].jsonObject["x"]!!.jsonPrimitive.int)
        assertEquals(4, next["tiles"]!!.jsonArray[1].jsonObject["x"]!!.jsonPrimitive.int)
    }

    @Test
    fun pendingPacketSurvivesSerializationWithoutANewMutationId() {
        val base = BattleMap(id = "map", revision = 7)
        val current = base.copy(name = "Локальная")
        val packet = MapPacket(7, "same-request", mapDiff(base.content, current.content))
        val stored =
            MapWork(
                key = "map",
                confirmed = base,
                current = current,
                sending = packet,
                sent = current.content,
            )
        val restored = WireJson.decodeFromString<MapWork>(WireJson.encodeToString(stored))
        assertEquals(packet, restored.sending)
        assertTrue(restored.dirty)
    }

    @Test
    fun newMapUsesTheExistingDocumentVersionAndPublishedMapsAreReadOnly() {
        assertEquals(2, newMapDocument()["version"]!!.jsonPrimitive.int)
        assertFalse(BattleMap(publishedAt = "2026-11-02").editable)
        assertFalse(BattleMap(owned = false).editable)
    }
}

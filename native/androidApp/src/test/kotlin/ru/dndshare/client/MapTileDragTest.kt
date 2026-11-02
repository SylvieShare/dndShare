package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.ui.maps.MapTileDrag

class MapTileDragTest {
    private val model = MapModel("floor", "floor", "Пол")

    private fun document() =
        newMapDocument()
            .with(
                "tiles",
                JsonArray(
                    listOf(
                        WireJson.parseToJsonElement(
                                """{"id":"tile","modelId":"floor","x":2,"y":2,"rotation":0,"level":0}"""
                            )
                            .jsonObject
                    )
                ),
            )

    @Test
    fun releasePreservesCanonicalFieldsReceivedWhileDragging() {
        val start = document()
        val drag = MapTileDrag()
        val models = mapOf("floor" to model)
        drag.move(start, models, "tile", MapPose(2.5, 2.5), false, emptySet(), {}, {})
        val latest = start.with("receivedWhileDragging", JsonPrimitive(true))
        var committed = latest
        drag.move(
            start,
            models,
            "tile",
            MapPose(4.5, 3.5),
            true,
            emptySet(),
            {},
            { committed = it(latest) },
        )
        assertEquals(JsonPrimitive(true), committed["receivedWhileDragging"])
        assertEquals(4, committed.rows("tiles").single().number("x").toInt())
        assertEquals(3, committed.rows("tiles").single().number("y").toInt())
        assertNull(drag.preview)
    }

    @Test
    fun returningToTheStartingPositionAndCancellingDoNotStrandThePreview() {
        val start = document()
        val drag = MapTileDrag()
        val models = mapOf("floor" to model)
        drag.move(start, models, "tile", MapPose(2.5, 2.5), false, emptySet(), {}, {})
        drag.move(start, models, "tile", MapPose(3.5, 2.5), false, setOf("tile"), {}, {})
        var result = start
        drag.move(
            start,
            models,
            "tile",
            MapPose(2.5, 2.5),
            true,
            setOf("tile"),
            {},
            { result = it(start) },
        )
        assertEquals(start, result)
        drag.cancel()
        assertNull(drag.preview)
    }
}

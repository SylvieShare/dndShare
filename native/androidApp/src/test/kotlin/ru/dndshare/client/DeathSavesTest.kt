package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.WireJson

class DeathSavesTest {
    private val hp =
        WireJson.parseToJsonElement(
                """{"current":0,"temp":4,"max":{"base":28},"ds_success":1,"ds_failure":2,"kept":true}"""
            )
            .jsonObject

    @Test
    fun selectingPipsAndTheThirdSuccessFollowTheWebWithoutLosingHealthMetadata() {
        assertEquals(JsonPrimitive(1), deathSaveChange(hp, "ds_failure", 2)["ds_failure"])
        val restored = deathSaveChange(hp, "ds_success", 3)
        assertEquals(JsonPrimitive(1), restored["current"])
        assertEquals(JsonPrimitive(0), restored["ds_success"])
        assertEquals(JsonPrimitive(0), restored["ds_failure"])
        for (key in listOf("temp", "max", "kept")) assertEquals(hp[key], restored[key])
    }

    @Test
    fun latePipsCannotReplaceAnAlreadyConsciousCharacter() {
        assertFails {
            deathSaveChange(JsonObject(hp + ("current" to JsonPrimitive(5))), "ds_success", 3)
        }
        assertFails { deathSaveChange(hp, "ds_success", 4) }
        assertFails { deathSaveChange(hp, "unexpected", 1) }
        assertEquals(JsonPrimitive(0), hp["current"])
    }
}

package ru.dndshare.client

import androidx.test.ext.junit.runners.AndroidJUnit4
import io.ktor.client.engine.mock.*
import io.ktor.http.*
import io.ktor.http.content.OutgoingContent
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.runner.RunWith
import java.util.UUID
import kotlin.test.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.network.ApiClient

@RunWith(AndroidJUnit4::class)
class CharacterSheetHttpTest {
    @Test fun canonicalPatchRouteAndVersionedPacketAreUsed() = runTest {
        val packet = SheetPacket(1, UUID.randomUUID().toString(), listOf(SheetPatch(path = sheetPath("values", "hp", "current"), value = JsonPrimitive(8))))
        val api = ApiClient("https://dndshare.ru", MemoryDeviceServices(), MockEngine { request ->
            assertEquals(HttpMethod.Patch, request.method)
            assertEquals("/api/char/example/data", request.url.encodedPath)
            val body = (request.body as OutgoingContent.ByteArrayContent).bytes().decodeToString()
            assertEquals(packet, WireJson.decodeFromString<SheetPacket>(body))
            assertEquals(setOf("op", "path", "value"), WireJson.parseToJsonElement(body).jsonObject.getValue("patches").jsonArray.single().jsonObject.keys)
            respond(WireJson.encodeToString(SheetChange(1, 2, packet.mutationId, packet.patches)),
                headers = headersOf(HttpHeaders.ContentType, "application/json"))
        })
        try { assertEquals(2L, api.saveCharacter("example", packet).version) }
        finally { api.close() }
    }
}

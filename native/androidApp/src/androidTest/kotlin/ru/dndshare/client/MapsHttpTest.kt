package ru.dndshare.client

import io.ktor.client.engine.mock.*
import io.ktor.http.*
import io.ktor.http.content.OutgoingContent
import kotlin.test.*
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.maps.*
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.network.ApiClient

class MapsHttpTest {
    @Test
    fun modelDownloadReportsReceivedBytesAndRejectsATruncatedSuccessfulResponse() = runTest {
        val bytes = byteArrayOf(1, 2, 3, 4, 5)
        var truncated = false
        val api =
            ApiClient(
                "https://dndshare.ru",
                MemoryDeviceServices(),
                MockEngine {
                    respond(
                        bytes,
                        headers =
                            headersOf(
                                HttpHeaders.ContentLength,
                                (if (truncated) 9 else bytes.size).toString(),
                            ),
                    )
                },
            )
        try {
            var received = 0L
            val result =
                HttpMapsApi(api).modelBytes("/api/maps/models/test/render") { loaded, _ ->
                    received = loaded
                }
            assertContentEquals(bytes, result)
            assertEquals(bytes.size.toLong(), received)
            truncated = true
            assertFailsWith<Exception> {
                HttpMapsApi(api).modelBytes("/api/maps/models/test/render")
            }
        } finally {
            api.close()
        }
    }

    @Test
    fun nativeCookieAndExactPatchPacketUseTheExistingApi() = runTest {
        var body: JsonObject? = null
        val api =
            ApiClient(
                "https://dndshare.ru",
                MemoryDeviceServices(),
                MockEngine { request ->
                    assertEquals("/api/maps/saved", request.url.encodedPath)
                    assertEquals(HttpMethod.Patch, request.method)
                    assertTrue(
                        request.headers[HttpHeaders.Cookie]
                            .orEmpty()
                            .contains("sylvieshare-session-id=7")
                    )
                    body =
                        WireJson.parseToJsonElement(
                                (request.body as OutgoingContent.ByteArrayContent)
                                    .bytes()
                                    .decodeToString()
                            )
                            .jsonObject
                    respond(
                        """{"fromVersion":3,"version":4,"patches":[{"op":"set","path":["name"],"value":"Новое"}],"metadata":{"id":"saved"}}""",
                        headers = headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                },
            )
        try {
            api.cookies.addCookie(Url(api.baseUrl), Cookie("sylvieshare-session-id", "7"))
            val packet =
                MapPacket(
                    3,
                    "stable-request",
                    listOf(
                        MapPatch(
                            path = listOf(JsonPrimitive("name")),
                            value = JsonPrimitive("Новое"),
                        )
                    ),
                )
            val response = HttpMapsApi(api).patch("saved", packet)
            assertEquals(4L, response.version)
            assertEquals("stable-request", body?.get("mutationId")?.jsonPrimitive?.content)
            assertEquals(3, body?.get("baseVersion")?.jsonPrimitive?.int)
        } finally {
            api.close()
        }
    }

    @Test
    fun adminMetadataPutUsesTechnicalUuidAndPreservesLogicalId() = runTest {
        val model = MapModel("UD-007", "f6ebd194-b684-48bb-9073-3a7a1ac79ba7", "Пол")
        val api =
            ApiClient(
                "https://dndshare.ru",
                MemoryDeviceServices(),
                MockEngine { request ->
                    assertEquals("/api/maps/models/${model.uuid}", request.url.encodedPath)
                    assertEquals(HttpMethod.Put, request.method)
                    val body =
                        WireJson.parseToJsonElement(
                                (request.body as OutgoingContent.ByteArrayContent)
                                    .bytes()
                                    .decodeToString()
                            )
                            .jsonObject
                    assertEquals(model.id, body.string("id"))
                    assertEquals(model.uuid, body.string("uuid"))
                    respond(
                        body.toString(),
                        headers = headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                },
            )
        try {
            val result = HttpMapsApi(api).updateModel(model, editableMapModel(model))
            assertEquals(model.id, result.id)
            assertEquals(model.uuid, result.uuid)
        } finally {
            api.close()
        }
    }

    @Test
    fun catalogueAcceptsNullableArraysAndKeepsTechnicalAndLogicalIdsSeparate() = runTest {
        val api =
            ApiClient(
                "https://dndshare.ru",
                MemoryDeviceServices(),
                MockEngine {
                    respond(
                        """[{"id":"UD-floor","uuid":"technical-uuid","name":"Пол","supportSlots":null,"placementPoints":null,"placementOffset":null,"behaviour":{}}]""",
                        headers = headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                },
            )
        try {
            val model = HttpMapsApi(api).models().single()
            assertEquals("UD-floor", model.id)
            assertEquals("technical-uuid", model.uuid)
            assertTrue(model.supportSlots.isEmpty())
            assertFailsWith<IllegalArgumentException> {
                HttpMapsApi(api).modelBytes("https://unrelated.example/model.glb")
            }
        } finally {
            api.close()
        }
    }
}

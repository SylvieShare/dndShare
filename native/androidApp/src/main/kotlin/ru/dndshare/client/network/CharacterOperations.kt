package ru.dndshare.client.network

import io.ktor.client.call.*
import io.ktor.client.request.*
import io.ktor.http.*
import kotlinx.serialization.json.*
import ru.dndshare.client.character.CharacterSheet
import ru.dndshare.client.model.*

suspend fun ApiClient.templates(): List<CharacterTemplate> =
    with(this) {
        client
            .get("$baseUrl/api/templates")
            .checked()
            .body<JsonObject>()["templates"]
            ?.jsonArray
            .orEmpty()
            .map { WireJson.decodeFromJsonElement(it) }
    }

suspend fun ApiClient.cloneCharacter(uuid: String): String =
    with(this) {
        client.post("$baseUrl/api/char/$uuid/clone").checked().body<JsonObject>().text("uuid")
    }

suspend fun ApiClient.deleteCharacter(uuid: String) =
    with(this) {
        client.delete("$baseUrl/api/char/$uuid").checked()
        Unit
    }

suspend fun ApiClient.createCharacter(
    templateId: Long,
    editionId: Long,
    data: JsonObject,
    iconUploadId: Long? = null,
): String =
    with(this) {
        client
            .post("$baseUrl/api/chars") {
                contentType(ContentType.Application.Json)
                setBody(
                    buildJsonObject {
                        put("templateId", templateId)
                        put("sourceVersionId", editionId)
                        put("data", data)
                        iconUploadId?.let { put("iconImageUploadId", it) }
                    }
                )
            }
            .checked()
            .body<JsonObject>()
            .text("uuid")
    }

suspend fun ApiClient.setCharacterPublic(uuid: String, visible: Boolean) =
    with(this) {
        client
            .put("$baseUrl/api/char/$uuid/public") {
                contentType(ContentType.Application.Json)
                setBody(buildJsonObject { put("publicVisible", visible) })
            }
            .checked()
        Unit
    }

suspend fun ApiClient.changeCharacterEdition(
    uuid: String,
    editionId: Long,
    version: Long,
): CharacterSheet =
    with(this) {
        client
            .put("$baseUrl/api/char/$uuid/edition") {
                contentType(ContentType.Application.Json)
                setBody(
                    buildJsonObject {
                        put("sourceVersionId", editionId)
                        put("version", version)
                        put("confirmed", true)
                    }
                )
            }
            .checked()
            .body()
    }

suspend fun ApiClient.characterHistory(uuid: String, before: Long? = null): JsonObject =
    with(this) {
        client
            .get("$baseUrl/api/char/$uuid/history") { before?.let { parameter("before", it) } }
            .checked()
            .body()
    }

suspend fun ApiClient.characterVersion(uuid: String): Long =
    with(this) {
        client
            .get("$baseUrl/api/char/$uuid/version")
            .checked()
            .body<JsonObject>()["version"]!!
            .jsonPrimitive
            .long
    }

suspend fun ApiClient.characterRequest(
    uuid: String,
    suffix: String,
    method: HttpMethod = HttpMethod.Get,
    payload: JsonObject? = null,
): JsonObject =
    with(this) {
        val response =
            client
                .request("$baseUrl/api/char/$uuid/$suffix") {
                    this.method = method
                    if (payload != null) {
                        contentType(ContentType.Application.Json)
                        setBody(payload)
                    }
                }
                .checked()
        if (response.status == HttpStatusCode.NoContent) JsonObject(emptyMap()) else response.body()
    }

suspend fun ApiClient.catalogue(
    typeId: Long,
    editionId: Long,
    books: List<Long>? = null,
): List<CatalogueItem> =
    with(this) {
        val all = mutableListOf<CatalogueItem>()
        while (true) {
            val page =
                client
                    .get("$baseUrl/api/items") {
                        parameter("typeId", typeId)
                        parameter("sourceVersionId", editionId)
                        parameter("limit", 500)
                        parameter("offset", all.size)
                        if (books != null) parameter("contentSourceIds", books.joinToString(","))
                    }
                    .checked()
                    .body<JsonObject>()["items"]
                    ?.jsonArray
                    .orEmpty()
                    .map { WireJson.decodeFromJsonElement<CatalogueItem>(it) }
            all.addAll(page)
            if (page.size < 500) break
        }
        all
    }

suspend fun ApiClient.creationMetadata(sourceId: Long, editionId: Long): HandbookMetadata =
    with(this) {
        val types =
            client
                .get("$baseUrl/api/item-types") { parameter("sourceId", sourceId) }
                .checked()
                .body<JsonObject>()
        val suggests =
            client
                .get("$baseUrl/api/suggest/batch") { parameter("typeIds", "3,4,5,6,12,15,16,17") }
                .checked()
                .body<JsonObject>()
        val books =
            client
                .get("$baseUrl/api/content-sources") { parameter("sourceVersionId", editionId) }
                .checked()
                .body<JsonObject>()
        HandbookMetadata(
            types = types["types"]?.jsonArray.orEmpty().map { WireJson.decodeFromJsonElement(it) },
            suggests =
                suggests["items"]?.jsonObject.orEmpty().mapValues { (_, rows) ->
                    rows.jsonArray.map { WireJson.decodeFromJsonElement(it) }
                },
            books =
                books["sources"]?.jsonArray.orEmpty().map { WireJson.decodeFromJsonElement(it) },
        )
    }

suspend fun ApiClient.session(uuid: String): JsonObject =
    with(this) {
        client.get("$baseUrl/api/sessions/$uuid").checked().body()
    }

suspend fun ApiClient.sessionD20(sessionUuid: String, body: JsonObject): JsonObject =
    with(this) {
        client
            .post("$baseUrl/api/sessions/$sessionUuid/d20") {
                contentType(ContentType.Application.Json)
                setBody(JsonObject(body + ("requestId" to body.getValue("clientActionId"))))
            }
            .checked()
            .body()
    }

suspend fun ApiClient.sessionEvent(sessionUuid: String, body: JsonObject): JsonObject =
    with(this) {
        client
            .post("$baseUrl/api/sessions/$sessionUuid/events") {
                contentType(ContentType.Application.Json)
                setBody(body)
            }
            .checked()
            .body()
    }

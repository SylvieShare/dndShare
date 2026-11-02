package ru.dndshare.client.maps

import io.ktor.client.call.body
import io.ktor.client.request.*
import io.ktor.client.request.forms.*
import io.ktor.http.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.network.ApiClient

interface MapsApi {
    suspend fun list(scope: String): List<BattleMap>

    suspend fun get(id: String): BattleMap

    suspend fun create(map: BattleMap): BattleMap

    suspend fun patch(id: String, packet: MapPacket): MapChange

    suspend fun copy(id: String): BattleMap

    suspend fun delete(id: String)

    suspend fun publish(id: String, revision: Long)

    suspend fun subscribe(id: String, enabled: Boolean)

    suspend fun rate(id: String, rating: Int)

    suspend fun models(): List<MapModel>

    suspend fun modelBytes(url: String): ByteArray

    suspend fun mediaBytes(url: String): ByteArray

    suspend fun decals(): List<MapDecalImage>

    suspend fun uploadDecal(bytes: ByteArray, name: String, category: String): MapDecalImage

    suspend fun previewContext(id: String): JsonObject

    suspend fun uploadPreview(id: String, signature: String, bytes: ByteArray): JsonObject

    suspend fun updateModel(model: MapModel, data: JsonObject): MapModel
}

class HttpMapsApi(private val api: ApiClient) : MapsApi {
    private fun url(path: String) = "${api.baseUrl}/api/maps$path"

    private suspend inline fun <reified T> request(
        path: String,
        method: HttpMethod = HttpMethod.Get,
        body: JsonElement? = null,
    ): T =
        withContext(Dispatchers.IO) {
            val response =
                api.client.request(url(path)) {
                    this.method = method
                    if (body != null) {
                        contentType(ContentType.Application.Json)
                        setBody(body)
                    }
                }
            with(api) { response.checked().body<T>() }
        }

    override suspend fun list(scope: String) =
        request<List<BattleMap>>("?scope=${scope.encodeURLParameter()}")

    override suspend fun get(id: String) = request<BattleMap>("/${id.encodeURLPathPart()}")

    override suspend fun create(map: BattleMap) =
        request<BattleMap>("", HttpMethod.Post, map.content)

    override suspend fun patch(id: String, packet: MapPacket) =
        withContext(Dispatchers.IO) {
            request<MapChange>(
                "/${id.encodeURLPathPart()}",
                HttpMethod.Patch,
                WireJson.encodeToJsonElement(packet),
            )
        }

    override suspend fun copy(id: String) =
        request<BattleMap>("/${id.encodeURLPathPart()}/copy", HttpMethod.Post, buildJsonObject {})

    override suspend fun delete(id: String) {
        request<Unit>("/${id.encodeURLPathPart()}", HttpMethod.Delete)
    }

    override suspend fun publish(id: String, revision: Long) {
        request<Unit>(
            "/${id.encodeURLPathPart()}/publish",
            HttpMethod.Post,
            buildJsonObject { put("revision", revision) },
        )
    }

    override suspend fun subscribe(id: String, enabled: Boolean) {
        request<Unit>(
            "/subscriptions/${id.encodeURLPathPart()}",
            if (enabled) HttpMethod.Put else HttpMethod.Delete,
            if (enabled) buildJsonObject {} else null,
        )
    }

    override suspend fun rate(id: String, rating: Int) {
        request<Unit>(
            "/ratings/${id.encodeURLPathPart()}",
            if (rating > 0) HttpMethod.Put else HttpMethod.Delete,
            if (rating > 0) buildJsonObject { put("rating", rating) } else null,
        )
    }

    override suspend fun models() =
        withContext(Dispatchers.Default) {
            request<List<JsonObject>>("/models").map { raw ->
                val fields = raw.toMutableMap()
                for (key in listOf("supportSlots", "placementPoints", "placementOffset")) if (
                    fields[key] == JsonNull
                )
                    fields[key] = JsonArray(emptyList())
                WireJson.decodeFromJsonElement<MapModel>(JsonObject(fields)).copy(raw = raw)
            }
        }

    override suspend fun modelBytes(url: String): ByteArray {
        val target = Url(url)
        val base = Url(api.baseUrl)
        val resolved = if (url.startsWith("/api/maps/models/")) "${api.baseUrl}$url" else url
        require(
            url.startsWith("/api/maps/models/") ||
                (target.host == base.host &&
                    target.protocol == base.protocol &&
                    target.port == base.port &&
                    target.encodedPath.startsWith("/api/maps/models/"))
        )
        return with(api) { client.get(resolved).checked().body() }
    }

    override suspend fun mediaBytes(url: String): ByteArray =
        withContext(Dispatchers.IO) {
            require(
                url.startsWith("/images/maps/decals/") || url.startsWith("/api/map-decal-images/")
            )
            with(api) { client.get(baseUrl + url).checked().body() }
        }

    override suspend fun decals() = request<List<MapDecalImage>>("/decals")

    override suspend fun uploadDecal(
        bytes: ByteArray,
        name: String,
        category: String,
    ): MapDecalImage =
        withContext(Dispatchers.IO) {
            require(bytes.size in 1..8 * 1024 * 1024)
            val response =
                api.client.submitFormWithBinaryData(
                    url("/decals"),
                    formData {
                        append("name", name)
                        append("category", category)
                        append(
                            "file",
                            bytes,
                            Headers.build {
                                append(HttpHeaders.ContentType, "image/png")
                                append(HttpHeaders.ContentDisposition, "filename=\"decal.png\"")
                            },
                        )
                    },
                )
            with(api) { response.checked().body() }
        }

    override suspend fun previewContext(id: String) =
        request<JsonObject>("/${id.encodeURLPathPart()}/preview-context")

    override suspend fun uploadPreview(
        id: String,
        signature: String,
        bytes: ByteArray,
    ): JsonObject =
        withContext(Dispatchers.IO) {
            with(api) {
                client
                    .post(
                        url(
                            "/${id.encodeURLPathPart()}/preview?signature=${signature.encodeURLParameter()}"
                        )
                    ) {
                        contentType(ContentType("image", "webp"))
                        setBody(bytes)
                    }
                    .checked()
                    .body()
            }
        }

    override suspend fun updateModel(model: MapModel, data: JsonObject): MapModel =
        withContext(Dispatchers.Default) {
            val result =
                request<JsonObject>(
                    "/models/${model.id.encodeURLPathPart()}",
                    HttpMethod.Put,
                    data
                        .with("id", JsonPrimitive(model.id))
                        .with("uuid", JsonPrimitive(model.uuid)),
                )
            WireJson.decodeFromJsonElement<MapModel>(result).copy(raw = result)
        }
}

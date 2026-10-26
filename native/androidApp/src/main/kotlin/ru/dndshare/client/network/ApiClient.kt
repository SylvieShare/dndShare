package ru.dndshare.client.network

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.HttpClientEngine
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.*
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.cookies.HttpCookies
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.*
import ru.dndshare.client.model.*
import ru.dndshare.client.device.DeviceServices

class ApiException(val status: Int, val code: String, message: String) : Exception(message)

class ApiClient(val baseUrl: String, platform: DeviceServices, engine: HttpClientEngine = OkHttp.create()) {
    val cookies = SessionCookies(platform, baseUrl)
    val client = HttpClient(engine) {
        expectSuccess = false
        install(ContentNegotiation) { json(WireJson) }
        install(HttpCookies) { storage = cookies }
        install(HttpTimeout) { requestTimeoutMillis = 45_000; connectTimeoutMillis = 15_000 }
    }

    private suspend fun HttpResponse.checked(): HttpResponse {
        if (status.isSuccess()) return this
        val error = runCatching { body<JsonObject>() }.getOrNull()
        val description = when (status.value) {
            401 -> "Сессия завершилась. Войдите снова."
            429 -> "Слишком много попыток. Попробуйте немного позже."
            else -> error?.text("desc").orEmpty().ifBlank { "Сервер временно недоступен." }
        }
        throw ApiException(status.value, error?.text("type").orEmpty(), description)
    }

    suspend fun login(login: String, password: String): User {
        val reply = client.post("$baseUrl/api/user/auth") {
            contentType(ContentType.Application.Json)
            setBody(buildJsonObject { put("login", login); put("password", password) })
        }.checked().body<AuthReply>()
        return reply.user?.takeIf { reply.auth }
            ?: throw ApiException(200, "INVALID_CREDENTIALS", "Неверный логин или пароль.")
    }

    suspend fun checkAuth(): User? = client.get("$baseUrl/api/user/checkAuth")
        .checked().body<AuthReply>().let { if (it.auth) it.user else null }

    suspend fun logout() { client.post("$baseUrl/api/user/logout").checked() }
    suspend fun sources(): List<GameSource> = client.get("$baseUrl/api/sources").checked().body<SourcesReply>().sources
    suspend fun characters(): List<Character> = client.get("$baseUrl/api/chars").checked().body<CharactersReply>().chars

    suspend fun sync(sourceId: Long, cursor: String?): SyncPage =
        client.get("$baseUrl/api/handbook/sync") {
            parameter("sourceId", sourceId)
            parameter("limit", 200)
            if (cursor != null) parameter("cursor", cursor)
        }.checked().body<SyncPage>()

    fun close() { client.close() }
}

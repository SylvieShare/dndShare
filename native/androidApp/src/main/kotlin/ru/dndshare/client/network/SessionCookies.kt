package ru.dndshare.client.network

import io.ktor.client.plugins.cookies.CookiesStorage
import io.ktor.http.*
import io.ktor.util.date.GMTDate
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.device.DeviceServices

@Serializable
private data class StoredCookie(val name: String, val value: String, val expiresAt: Long, val secure: Boolean)

class SessionCookies(
    private val platform: DeviceServices,
    baseUrl: String,
) : CookiesStorage {
    private val host = Url(baseUrl).host
    private val lock = Mutex()
    private val names = setOf("sylvieshare-session-id", "sylvieshare-session-uuid")

    private fun load(): List<StoredCookie> = platform.secureStore.read("cookies")?.let {
        runCatching { WireJson.decodeFromString<List<StoredCookie>>(it) }.getOrNull()
    }.orEmpty().filter { it.expiresAt > platform.nowMillis() && it.name in names }

    override suspend fun get(requestUrl: Url): List<Cookie> = lock.withLock {
        if (requestUrl.host != host) return@withLock emptyList()
        load().filter { !it.secure || requestUrl.protocol.name == "https" }.map {
            Cookie(
                name = it.name, value = it.value, encoding = CookieEncoding.RAW,
                domain = host, path = "/", secure = it.secure, httpOnly = true,
                expires = GMTDate(it.expiresAt),
            )
        }
    }

    override suspend fun addCookie(requestUrl: Url, cookie: Cookie) = lock.withLock {
        if (requestUrl.host != host || cookie.name !in names) return@withLock
        val remaining = load().filterNot { it.name == cookie.name }.toMutableList()
        val maxAge = cookie.maxAge
        val expiry = cookie.expires?.timestamp ?: (
            platform.nowMillis() + (if (maxAge != null && maxAge > 0) maxAge.toLong().coerceAtMost(2_592_000) else 2_592_000) * 1000
        )
        if (maxAge != 0 && cookie.value.isNotEmpty() && expiry > platform.nowMillis()) {
            remaining += StoredCookie(cookie.name, cookie.value, expiry, cookie.secure)
        }
        platform.secureStore.write("cookies", WireJson.encodeToString(remaining))
    }

    fun hasSession(): Boolean = load().map { it.name }.toSet().containsAll(names)
    fun clear() { platform.secureStore.write("cookies", null) }
    override fun close() = Unit
}

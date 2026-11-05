package ru.dndshare.client.app

import kotlinx.serialization.encodeToString
import ru.dndshare.client.device.SecureStore
import ru.dndshare.client.model.WireJson

internal class AccountNavigationStore(private val storage: SecureStore, accountId: Long) {
    private val prefix = prefix(accountId)
    private val written = mutableMapOf<String, String>()

    @Synchronized
    fun read(scope: String): String? = runCatching { storage.read(prefix + scope) }.getOrNull()

    @Synchronized
    fun write(scope: String, value: String) {
        if (written[scope] == value) return
        if (runCatching { storage.write(prefix + scope, value) }.isSuccess) {
            written[scope] = value
        }
    }

    companion object {
        private fun prefix(accountId: Long): String {
            require(accountId > 0)
            return "navigation:$accountId:"
        }

        fun clear(storage: SecureStore, accountId: Long) {
            val prefix = prefix(accountId)
            storage.keys().filter { it.startsWith(prefix) }.forEach { storage.write(it, null) }
        }
    }
}

internal inline fun <reified T> AccountNavigationStore.load(scope: String): T? =
    read(scope)?.let { runCatching { WireJson.decodeFromString<T>(it) }.getOrNull() }

internal inline fun <reified T> AccountNavigationStore.save(scope: String, value: T) {
    write(scope, WireJson.encodeToString(value))
}

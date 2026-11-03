package ru.dndshare.client.maps.rendering

/** One successful upload cannot dismiss another required file's failure. Renderer-thread owned. */
internal class MapLoadFailures {
    private val messages = linkedMapOf<String, String>()
    val message
        get() = messages.values.firstOrNull()

    operator fun contains(key: String) = key in messages

    fun set(key: String, message: String?) {
        if (message == null) messages.remove(key)
        else messages[key] = message.ifBlank { "Не удалось загрузить ресурс карты" }
    }

    fun fail(key: String, message: String?) =
        set(key, message ?: "Не удалось загрузить ресурс карты")

    fun retain(keys: Set<String>) {
        messages.keys.retainAll(keys)
    }

    fun clear() = messages.clear()
}

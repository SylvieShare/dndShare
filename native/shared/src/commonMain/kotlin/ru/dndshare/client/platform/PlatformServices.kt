package ru.dndshare.client.platform

import ru.dndshare.client.data.ClientDatabase

interface SecureStore {
    fun read(key: String): String?
    fun write(key: String, value: String?)
}

interface PlatformServices {
    val secureStore: SecureStore
    fun database(userId: Long): ClientDatabase
    fun mediaDirectory(userId: Long): String
    fun eraseAccount(userId: Long)
    fun nowMillis(): Long
}

expect fun formatServerTime(value: String): String

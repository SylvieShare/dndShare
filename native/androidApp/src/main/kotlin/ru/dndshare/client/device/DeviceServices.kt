package ru.dndshare.client.device

import ru.dndshare.client.data.ClientDatabase

interface SecureStore {
    fun keys(): Set<String>

    fun read(key: String): String?

    fun write(key: String, value: String?)
}

interface DeviceServices {
    val stagedMediaDirectory: String
    val secureStore: SecureStore

    fun database(userId: Long): ClientDatabase

    fun mediaDirectory(userId: Long): String

    fun eraseAccount(userId: Long)

    fun nowMillis(): Long
}

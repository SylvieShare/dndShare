package ru.dndshare.client

import ru.dndshare.client.data.ClientDatabase
import ru.dndshare.client.device.*

class MemoryDeviceServices : DeviceServices {
    var now = 1_000_000L
    private val values = mutableMapOf<String, String>()
    override val secureStore = object : SecureStore {
        override fun read(key: String) = values[key]
        override fun write(key: String, value: String?) { if (value == null) values.remove(key) else values[key] = value }
    }
    override fun database(userId: Long): ClientDatabase = error("No database in this test")
    override fun mediaDirectory(userId: Long) = "unused"
    override fun eraseAccount(userId: Long) = Unit
    override fun nowMillis() = now
}

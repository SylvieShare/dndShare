package ru.dndshare.client.platform

import androidx.room3.Room
import com.sun.jna.platform.win32.Crypt32Util
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlinx.serialization.encodeToString
import ru.dndshare.client.data.*
import ru.dndshare.client.model.WireJson

class DesktopPlatform(baseUrl: String) : PlatformServices {
    private val namespace = MessageDigest.getInstance("SHA-256").digest(baseUrl.toByteArray())
        .joinToString("") { "%02x".format(it) }.take(24)
    private val root = File(
        requireNotNull(System.getenv("LOCALAPPDATA")) { "Windows LOCALAPPDATA is required." },
        "DnDShare/client/$namespace",
    ).apply { mkdirs() }
    override val secureStore: SecureStore = WindowsSecureStore(File(root, "session.bin"))
    private fun account(userId: Long): File {
        require(userId > 0)
        return File(root, "accounts/$userId").apply { mkdirs() }
    }
    override fun database(userId: Long): ClientDatabase = buildDatabase(
        Room.databaseBuilder<ClientDatabase>(name = File(account(userId), "catalogue.db").absolutePath),
    )
    override fun mediaDirectory(userId: Long): String = File(account(userId), "media").absolutePath
    override fun eraseAccount(userId: Long) { account(userId).deleteRecursively() }
    override fun nowMillis(): Long = System.currentTimeMillis()
}

private class WindowsSecureStore(private val file: File) : SecureStore {
    private val lock = Any()
    private fun values(): Map<String, String> = if (!file.exists()) emptyMap() else runCatching {
        val clear = Crypt32Util.cryptUnprotectData(file.readBytes())
        WireJson.decodeFromString<Map<String, String>>(String(clear, Charsets.UTF_8))
    }.getOrDefault(emptyMap())

    override fun read(key: String): String? = synchronized(lock) { values()[key] }

    override fun write(key: String, value: String?) = synchronized(lock) {
        val values = values().toMutableMap()
        if (value == null) values.remove(key) else values[key] = value
        val bytes = Crypt32Util.cryptProtectData(WireJson.encodeToString(values).toByteArray(Charsets.UTF_8))
        val temporary = File(file.parentFile, file.name + ".tmp")
        temporary.writeBytes(bytes)
        Files.move(temporary.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
        Unit
    }
}

actual fun formatServerTime(value: String): String = runCatching {
    DateTimeFormatter.ofPattern("dd.MM HH:mm").withZone(ZoneId.systemDefault()).format(Instant.parse(value))
}.getOrDefault(value)

package ru.dndshare.client.device

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.room3.Room
import java.io.File
import java.security.KeyStore
import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import ru.dndshare.client.data.*

class AndroidDeviceServices(context: Context, baseUrl: String) : DeviceServices {
    private val app = context.applicationContext
    private val namespace = MessageDigest.getInstance("SHA-256").digest(baseUrl.toByteArray())
        .joinToString("") { "%02x".format(it) }.take(24)
    private val root = File(app.filesDir, "native/$namespace").apply { mkdirs() }
    override val secureStore: SecureStore = AndroidSecureStore(app, namespace)
    private fun account(userId: Long): File {
        require(userId > 0)
        return File(root, "accounts/$userId").apply { mkdirs() }
    }
    override fun database(userId: Long): ClientDatabase = buildDatabase(
        Room.databaseBuilder<ClientDatabase>(app, File(account(userId), "catalogue.db").absolutePath),
    )
    override fun mediaDirectory(userId: Long): String = File(account(userId), "media").absolutePath
    override fun eraseAccount(userId: Long) { account(userId).deleteRecursively() }
    override fun nowMillis(): Long = System.currentTimeMillis()
}

private class AndroidSecureStore(context: Context, namespace: String) : SecureStore {
    private val preferences = context.getSharedPreferences("native-session-$namespace", Context.MODE_PRIVATE)
    private val alias = "dndshare-session-$namespace"
    private val lock = Any()

    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }

    override fun read(key: String): String? = synchronized(lock) {
        preferences.getString(key, null)?.let { encoded ->
            runCatching {
                val bytes = Base64.decode(encoded, Base64.NO_WRAP)
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
                String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
            }.getOrNull()
        }
    }

    override fun write(key: String, value: String?) = synchronized(lock) {
        if (value == null) {
            preferences.edit().remove(key).commit()
        } else {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, key())
            val bytes = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
            check(preferences.edit().putString(key, Base64.encodeToString(bytes, Base64.NO_WRAP)).commit())
        }
        Unit
    }
}

fun formatServerTime(value: String): String = runCatching {
    DateTimeFormatter.ofPattern("dd.MM HH:mm").withZone(ZoneId.systemDefault()).format(Instant.parse(value))
}.getOrDefault(value)

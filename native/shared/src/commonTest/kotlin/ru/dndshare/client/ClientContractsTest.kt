package ru.dndshare.client

import androidx.compose.ui.graphics.Color
import io.ktor.http.*
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.*
import kotlin.test.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*
import ru.dndshare.client.network.SessionCookies
import ru.dndshare.client.platform.*
import ru.dndshare.client.ui.*

class ClientContractsTest {
    @Test fun adaptiveFormatsUseAvailableWindow() {
        assertEquals(LayoutFormat.Phone, layoutFormat(599f))
        assertEquals(LayoutFormat.Tablet, layoutFormat(600f))
        assertEquals(LayoutFormat.Tablet, layoutFormat(1199f))
        assertEquals(LayoutFormat.Desktop, layoutFormat(1200f))
    }

    @Test fun cyrillicSearchKeepsSqlWildcardsLiteral() {
        assertEquals("%огонь\\_100\\%\\\\%", searchPattern(" ОГОНЬ_100%\\ "))
    }

    @Test fun richContentKeepsTextAndItemReferencesWithoutWebView() {
        val html = "<p><strong>Магия</strong> и <em>атака</em><br>" +
            "<span data-rich-node='item' data-rich-payload='%7B%22id%22%3A42%7D'>Огонь</span></p>" +
            "<script>secret()</script><ul><li>Первый</li><li>Второй</li></ul>"
        val result = richDescription(html, Color.Blue)
        assertContains(result.text, "Магия и атака\nОгонь")
        assertContains(result.text, "• Первый\n• Второй")
        assertFalse(result.text.contains("secret"))
        val ref = result.getStringAnnotations("item", 0, result.length).single()
        assertEquals("42", ref.item)
        assertEquals("Огонь", result.text.substring(ref.start, ref.end))
    }

    @Test fun characterNamesAndLevelsUseTemplateData() {
        val dnd = WireJson.decodeFromString<Character>("""{"id":1,"uuid":"d","data":{"values":{"name":"Лира","lvl":{"level":7}}}}""")
        val vtm = WireJson.decodeFromString<Character>("""{"id":2,"uuid":"v","data":{"values":{"char_name":"Ночь"}}}""")
        assertEquals("Лира", dnd.name)
        assertEquals("7", dnd.level)
        assertEquals("Ночь", vtm.name)
        assertEquals("—", vtm.level)
    }

    @Test fun sessionCookiesPersistAndNeverGoToMediaHost() = runTest {
        val platform = MemoryPlatform()
        val url = Url("https://dndshare.ru/api/user/auth")
        val cookies = SessionCookies(platform, "https://dndshare.ru")
        for (name in listOf("sylvieshare-session-id", "sylvieshare-session-uuid")) {
            cookies.addCookie(url, Cookie(name, "private", maxAge = 30, secure = true))
        }
        val restored = SessionCookies(platform, "https://dndshare.ru")
        assertTrue(restored.hasSession())
        assertEquals(2, restored.get(url).size)
        assertTrue(restored.get(Url("https://s3.example/image.webp")).isEmpty())
        assertTrue(restored.get(Url("http://dndshare.ru/")).isEmpty())
        platform.now += 31_000
        assertFalse(restored.hasSession())
        restored.clear()
        assertNull(platform.secureStore.read("cookies"))
    }
}

class MemoryPlatform : PlatformServices {
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

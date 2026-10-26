package ru.dndshare.client

import androidx.compose.ui.graphics.Color
import io.ktor.http.*
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.*
import kotlin.test.*
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*
import ru.dndshare.client.network.SessionCookies
import ru.dndshare.client.device.*
import ru.dndshare.client.ui.*

class ClientContractsTest {
    @Test fun accountNavigationRespectsRolesAndCharacterAvailability() {
        val player = User(1, "player", hasCharacters = true)
        assertContains(appDestinations(player), AppPage.Characters)
        assertFalse(AppPage.CreateCharacter in appDestinations(player))
        assertFalse(AppPage.Admin in appDestinations(player))
        assertContains(appDestinations(player.copy(roles = listOf("ADMIN"))), AppPage.Admin)
    }

    @Test fun emptyAccountOffersCreationWithoutAdvertisingAnExistingCharacterList() {
        val pages = appDestinations(User(1, "new-player"))
        assertContains(pages, AppPage.CreateCharacter)
        assertFalse(AppPage.Characters in pages)
        assertContains(pages, AppPage.Handbook)
        assertContains(pages, AppPage.Rules)
    }

    @Test fun adaptiveFormatsUseAvailableWindow() {
        assertEquals(LayoutFormat.Phone, layoutFormat(599f))
        assertEquals(LayoutFormat.Tablet, layoutFormat(600f))
        assertEquals(LayoutFormat.Tablet, layoutFormat(1199f))
        assertEquals(LayoutFormat.Wide, layoutFormat(1200f))
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
        val platform = MemoryDeviceServices()
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

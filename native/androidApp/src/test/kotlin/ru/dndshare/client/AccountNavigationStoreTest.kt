package ru.dndshare.client

import java.io.IOException
import kotlin.test.*
import org.junit.Test
import ru.dndshare.client.app.AccountNavigationStore
import ru.dndshare.client.app.load
import ru.dndshare.client.app.save
import ru.dndshare.client.device.SecureStore
import ru.dndshare.client.ui.AppNavigationState
import ru.dndshare.client.ui.AppPage
import ru.dndshare.client.ui.HandbookNavigationState

class AccountNavigationStoreTest {
    @Test
    fun aFreshStoreRestoresThePageCharacterAndHandbookLocation() {
        val storage = MemoryDeviceServices().secureStore
        val first = AccountNavigationStore(storage, 7)
        val application = AppNavigationState(AppPage.Characters.name, listOf("first", "hero"))
        val handbook = HandbookNavigationState(12, true, 0, listOf(101, 102))
        first.save("application", application)
        first.save("sheet:hero", "Stats")
        first.save("handbook:1:2", handbook)
        first.save("map-editor", "map-uuid")

        val restarted = AccountNavigationStore(storage, 7)
        assertEquals(application, restarted.load<AppNavigationState>("application"))
        assertEquals("Stats", restarted.load<String>("sheet:hero"))
        assertEquals(handbook, restarted.load<HandbookNavigationState>("handbook:1:2"))
        assertEquals("map-uuid", restarted.load<String>("map-editor"))
        restarted.save<String?>("map-editor", null)
        assertNull(AccountNavigationStore(storage, 7).load<String>("map-editor"))
    }

    @Test
    fun accountsAndHandbookContextsStayIndependentAndLogoutClearsOnlyItsOwner() {
        val storage = MemoryDeviceServices().secureStore
        storage.write("cookies", "session")
        val first = AccountNavigationStore(storage, 7)
        val second = AccountNavigationStore(storage, 8)
        first.save("application", AppNavigationState(AppPage.Maps.name))
        first.save("handbook:1:2", HandbookNavigationState(12, true))
        second.save("application", AppNavigationState(AppPage.Rules.name))
        assertNull(first.load<HandbookNavigationState>("handbook:1:3"))
        assertNull(second.load<HandbookNavigationState>("handbook:1:2"))
        AccountNavigationStore.clear(storage, 7)
        assertNull(AccountNavigationStore(storage, 7).load<AppNavigationState>("application"))
        assertEquals(AppPage.Rules.name, second.load<AppNavigationState>("application")?.page)
        assertEquals("session", storage.read("cookies"))
    }

    @Test
    fun invalidPagesAndTemporaryCreationRoutesHaveAStableStartPage() {
        for (page in listOf("removed-page", AppPage.CreateCharacter.name, AppPage.Admin.name)) {
            assertEquals(AppNavigationState(), AppNavigationState(page, listOf("hero")).normalized())
        }
        assertEquals(AppPage.Admin.name, AppNavigationState(AppPage.Admin.name).normalized(true).page)
        assertEquals(
            listOf("hero"),
            AppNavigationState(AppPage.Characters.name, listOf("", "hero")).normalized().characters,
        )
        val storage = MemoryDeviceServices().secureStore
        storage.write("navigation:7:application", "broken JSON")
        assertNull(AccountNavigationStore(storage, 7).load<AppNavigationState>("application"))
    }

    @Test
    fun identicalSnapshotsSkipDiskWritesAndAFailedWriteCanBeRetried() {
        var writes = 0
        var failure = true
        val storage = object : SecureStore {
            override fun keys() = emptySet<String>()
            override fun read(key: String): String? = throw IOException("unreadable")
            override fun write(key: String, value: String?) {
                writes++
                if (failure) throw IOException("read only")
            }
        }
        val navigation = AccountNavigationStore(storage, 7)
        assertNull(navigation.load<AppNavigationState>("application"))
        navigation.save("application", AppNavigationState())
        failure = false
        navigation.save("application", AppNavigationState())
        navigation.save("application", AppNavigationState())
        assertEquals(2, writes)
    }
}

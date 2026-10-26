package ru.dndshare.client

import android.content.Context
import androidx.room3.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import io.ktor.client.engine.mock.*
import io.ktor.http.*
import kotlinx.coroutines.*
import kotlinx.serialization.encodeToString
import org.junit.runner.RunWith
import kotlin.test.*
import ru.dndshare.client.app.AppController
import ru.dndshare.client.data.*
import ru.dndshare.client.device.DeviceServices
import ru.dndshare.client.model.*
import ru.dndshare.client.network.ApiClient

@RunWith(AndroidJUnit4::class)
class StartupLogoutTest {
    @Test fun logoutCancelsPendingSessionCheckBeforeClearingAccount() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val device = object : DeviceServices by MemoryDeviceServices() {
            override fun database(userId: Long) = buildDatabase(Room.inMemoryDatabaseBuilder<ClientDatabase>(context))
        }
        val user = User(7, "cached-user")
        device.secureStore.write("user", WireJson.encodeToString(user))
        val started = CompletableDeferred<Unit>()
        val finished = CompletableDeferred<Unit>()
        val allowResponse = CompletableDeferred<Unit>()
        val api = ApiClient("https://dndshare.ru", device, MockEngine {
            started.complete(Unit)
            try {
                allowResponse.await()
                respond(WireJson.encodeToString(AuthReply(true, user)),
                    headers = headersOf(HttpHeaders.ContentType, "application/json"))
            } finally { finished.complete(Unit) }
        })
        for (name in listOf("sylvieshare-session-id", "sylvieshare-session-uuid")) {
            api.cookies.addCookie(Url("https://dndshare.ru"), Cookie(name, "test-session", maxAge = 60, secure = true))
        }
        val controller = AppController(device, api)
        try {
            withTimeout(10_000) { started.await() }
            assertEquals(7, controller.state.value.user?.id?.toInt())
            withTimeout(10_000) { controller.logout().join() }
            assertTrue(finished.isCompleted, "Logout must cancel the pending authentication response")
            assertNull(controller.state.value.user)
            assertFalse(api.cookies.hasSession())
            assertNull(device.secureStore.read("user"))
        } finally { allowResponse.complete(Unit); controller.close() }
    }
}

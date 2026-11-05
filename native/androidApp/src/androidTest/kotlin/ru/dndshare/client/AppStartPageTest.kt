package ru.dndshare.client

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.room3.Room
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import io.ktor.client.engine.mock.*
import io.ktor.http.*
import java.io.File
import kotlin.test.assertEquals
import kotlinx.coroutines.*
import kotlinx.serialization.encodeToString
import org.junit.Test
import ru.dndshare.client.app.*
import ru.dndshare.client.data.*
import ru.dndshare.client.device.DeviceServices
import ru.dndshare.client.model.*
import ru.dndshare.client.network.ApiClient
import ru.dndshare.client.ui.*

class AppStartPageTest {
    @Test
    fun aNewControllerAndActivityOpenTheLastVisitedPage() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val device = object : DeviceServices by MemoryDeviceServices() {
            override val stagedMediaDirectory = File(context.cacheDir, "start-page-staging").absolutePath
            override fun mediaDirectory(userId: Long) =
                File(context.cacheDir, "start-page-media/$userId").absolutePath
            override fun database(userId: Long) =
                buildDatabase(Room.inMemoryDatabaseBuilder<ClientDatabase>(context))
        }
        val user = User(7, "cached-user", hasCharacters = true)
        device.secureStore.write("user", WireJson.encodeToString(user))
        suspend fun open(): Pair<AppController, ActivityScenario<ComponentActivity>> {
            val api = ApiClient("https://dndshare.ru", device, MockEngine { request ->
                val body = if (request.url.encodedPath == "/api/user/checkAuth")
                    WireJson.encodeToString(AuthReply(true, user)) else "{}"
                respond(body, headers = headersOf(HttpHeaders.ContentType, "application/json"))
            })
            for (name in listOf("sylvieshare-session-id", "sylvieshare-session-uuid")) {
                api.cookies.addCookie(
                    Url("https://dndshare.ru"),
                    Cookie(name, "test-session", maxAge = 60, secure = true),
                )
            }
            val controller = withContext(Dispatchers.Main) { AppController(device, api) }
            val activity = ActivityScenario.launch(ComponentActivity::class.java)
            activity.onActivity { host ->
                host.setContent { DndShareApp(controller, onBackground = {}) }
            }
            return controller to activity
        }
        suspend fun close(opened: Pair<AppController, ActivityScenario<ComponentActivity>>) {
            opened.second.close()
            withContext(Dispatchers.Main) { opened.first.close() }
        }
        val first = open()
        try {
            TouchRobot.click("Правила игрока")
            TouchRobot.await("Rules page") {
                TouchRobot.find("Правила и статьи для вашей игровой системы.") != null
            }
            assertEquals(
                AppPage.Rules.name,
                AccountNavigationStore(device.secureStore, user.id)
                    .load<AppNavigationState>("application")?.page,
            )
        } finally { close(first) }

        val restarted = open()
        try {
            TouchRobot.await("Last page after a cold start") {
                TouchRobot.find("Правила и статьи для вашей игровой системы.") != null
            }
            assertEquals(user.id, restarted.first.state.value.user?.id)
        } finally { close(restarted) }
    }
}

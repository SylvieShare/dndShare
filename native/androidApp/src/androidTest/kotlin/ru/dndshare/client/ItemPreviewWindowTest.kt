package ru.dndshare.client

import android.content.Context
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.room3.Room
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import coil3.ImageLoader
import kotlin.test.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.ItemPreviewDialog
import ru.dndshare.client.ui.designsystem.*

class ItemPreviewWindowTest {
    @get:org.junit.Rule val animations = AnimatorScaleRule()

    @Test fun nestedReferencesReturnToTheirPreviewAndBackground() = exercise(false)

    @Test fun compactPreviewClosesWithADownwardHandleSwipe() = exercise(true)

    @Test fun magicCoverKeepsRarityAndChargesVisible() = exercise(true, true)

    private fun exercise(compact: Boolean, magic: Boolean = false) {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val db = buildDatabase(Room.inMemoryDatabaseBuilder<ClientDatabase>(context))
        val images = ImageLoader.Builder(context).build()
        val first =
            CatalogueItem(
                1,
                if (magic) 19 else 5,
                "Огненная искра",
                data =
                    buildJsonObject {
                        put("lvl", 1)
                        put("desc", "<p>Первое описание.</p>")
                        put("related", 2)
                        put("die", 2)
                        if (magic) {
                            put("type", "Жезл")
                            put("rarity", 4)
                            put("max_use", 7)
                            put("attunement", "none")
                        }
                    },
            )
        val second =
            CatalogueItem(
                2,
                5,
                "Луч мороза",
                data =
                    buildJsonObject {
                        put("lvl", 0)
                        put("desc", "<p>Второе описание.</p>")
                    },
            )
        val items = listOf(first, second)
        val fields = buildJsonArray {
            add(
                buildJsonObject {
                    put("key", "desc")
                    put("name", "Описание")
                    put("type", "description")
                }
            )
            add(
                buildJsonObject {
                    put("key", "related")
                    put("name", "Связано")
                    put("type", "item")
                }
            )
        }
        val withDice =
            JsonArray(
                fields +
                    buildJsonObject {
                        put("key", "die")
                        put("name", "Кубик")
                        put("type", "dice")
                    }
            )
        val metadata =
            HandbookMetadata(
                types =
                    listOf(
                        ItemType(5, "Заклинания", fields = withDice),
                        ItemType(19, "Магические предметы", fields = fields),
                    ),
                suggests = mapOf("1" to listOf(Suggest(2, 1, "к6"))),
            )
        runBlocking {
            db.cache()
                .upsertItems(
                    items.map {
                        CachedItem(
                            1,
                            it.id,
                            it.typeId,
                            it.name,
                            "",
                            it.name,
                            "",
                            false,
                            1,
                            WireJson.encodeToString(it),
                        )
                    }
                )
        }
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { host ->
                    host.setContent {
                        CompositionLocalProvider(
                            LocalDensity provides Density(if (compact) 3f else 1f, 1f)
                        ) {
                            var stack by remember { mutableStateOf(listOf(1L)) }
                            ShareTheme {
                                Text("Фоновый лист")
                                if (stack.isNotEmpty())
                                    ItemPreviewDialog(
                                        db.cache(),
                                        1,
                                        stack.last(),
                                        metadata,
                                        images,
                                        close = { stack = stack.dropLast(1) },
                                        open = { stack = stack + it },
                                        canGoBack = stack.size > 1,
                                        initialItem = items.firstOrNull { it.id == stack.last() },
                                    )
                            }
                        }
                    }
                }
                TouchRobot.await { TouchRobot.find("Огненная искра") != null }
                if (compact) {
                    var previous = TouchRobot.bounds("Потянуть, чтобы закрыть просмотр")
                    var stable = 0
                    TouchRobot.await("preview settles") {
                        val now = TouchRobot.bounds("Потянуть, чтобы закрыть просмотр")
                        stable = if (now == previous) stable + 1 else 0
                        previous = now
                        android.os.SystemClock.sleep(90)
                        stable >= 3
                    }
                    if (magic) {
                        val rarity = TouchRobot.bounds("Легендарный")
                        val charges = TouchRobot.bounds("7")
                        val tuning = TouchRobot.bounds("Без настройки")
                        assertTrue(rarity.width() > 0 && rarity.height() > 0)
                        assertTrue(charges.width() > 0 && charges.height() > 0)
                        assertTrue(rarity.bottom <= tuning.top, "Rarity must fit before the rail")
                        assertTrue(charges.bottom <= tuning.top, "Charges must fit before the rail")
                    }
                    val handle = TouchRobot.bounds("Потянуть, чтобы закрыть просмотр")
                    val height = context.resources.displayMetrics.heightPixels
                    TouchRobot.drag(
                        handle.exactCenterX(),
                        handle.exactCenterY(),
                        handle.exactCenterX(),
                        (height - 100).toFloat(),
                        500,
                    )
                } else {
                    TouchRobot.click("Луч мороза")
                    TouchRobot.await {
                        TouchRobot.findNode { it.text?.toString()?.trim() == "Второе описание." } !=
                            null
                    }
                    TouchRobot.click("Назад к предмету")
                    TouchRobot.await {
                        TouchRobot.findNode { it.text?.toString()?.trim() == "Первое описание." } !=
                            null
                    }
                    TouchRobot.click("Закрыть просмотр")
                }
                TouchRobot.await {
                    TouchRobot.find("Фоновый лист") != null &&
                        TouchRobot.find("Закрыть просмотр") == null
                }
            }
        } finally {
            images.shutdown()
            db.close()
        }
    }
}

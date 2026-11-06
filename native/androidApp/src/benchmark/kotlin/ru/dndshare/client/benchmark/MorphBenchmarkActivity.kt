package ru.dndshare.client.benchmark

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import coil3.ImageLoader
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.HandbookMetadata
import ru.dndshare.client.ui.DndTheme
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.*

/** Benchmark-only entry point: actual UI components, synthetic data, no account or API. */
class MorphBenchmarkActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val extraSkills = intent.getIntExtra("skills", 0).coerceIn(0, 100)
        if (intent.getBooleanExtra("liveSkill", false)) {
            showLiveSkillBenchmark(benchmarkSheet(extraSkills))
            return
        }
        setContent {
            DndTheme {
                val sheet = remember { benchmarkSheet(extraSkills) }
                val images = remember { ImageLoader.Builder(applicationContext).build() }
                DisposableEffect(images) { onDispose { images.shutdown() } }
                var editor by remember { mutableStateOf<SheetEditorState?>(null) }
                Box(
                    Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)
                ) {
                    val metadata = remember { HandbookMetadata() }
                    val context =
                        SheetContext(
                            sheet,
                            metadata,
                            emptyMap(),
                            images,
                            true,
                            edit = { target ->
                                editor = SheetEditorState(initialForm(target, sheet), sheet)
                            },
                            openItem = {},
                            mechanics = remember { DndDerivedValues(sheet, emptyMap(), metadata) },
                            journal = SheetJournalState(),
                        )
                    CompositionLocalProvider(LocalCharacterSheet provides context) {
                        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(DesignTokens.Spacing.Page)) {
                            DndStats()
                        }
                        editor?.takeIf { it.isDndStat() }?.let { current ->
                            SheetStatDialog(
                                current, context.mechanics,
                                close = { editor = null },
                                number = { _, value ->
                                    editor = editor?.let {
                                        it.copy(fields = it.fields.copy(number = value))
                                    }
                                },
                                input = { key, value ->
                                    editor = editor?.let {
                                        it.copy(
                                            fields =
                                                it.fields.copy(
                                                    input =
                                                        JsonObject(it.fields.input + (key to value))
                                                )
                                        )
                                    }
                                },
                                readInput = { editor?.fields?.input ?: JsonObject(emptyMap()) },
                                syncError = null,
                                retry = {},
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun benchmarkSheet(extraSkills: Int) =
    CharacterSheet(
        "DND5",
        1,
        buildJsonObject {
            put(
                "values",
                buildJsonObject {
                    put("name", "Проверка морфа")
                    put("lvl", buildJsonObject { put("level", 5) })
                    dndAbilities.forEach { ability ->
                        put(
                            ability.id,
                            buildJsonObject {
                                put(
                                    "value",
                                    buildJsonObject {
                                        put("base", 12)
                                        put("bonuses", JsonArray(emptyList()))
                                    },
                                )
                                put("save_up", false)
                                put(
                                    "skills",
                                    buildJsonObject {
                                        if (ability.id == "STR")
                                            repeat(extraSkills) { index ->
                                                put(
                                                    "benchmark-$index",
                                                    buildJsonObject {
                                                        put(
                                                            "override_title",
                                                            "Дополнительный навык с длинным названием ${index + 1}",
                                                        )
                                                        put("up", index % 3)
                                                    },
                                                )
                                            }
                                    },
                                )
                            },
                        )
                    }
                },
            )
        },
        1,
        sourceVersion = "2014",
    )

package ru.dndshare.client

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LocalContentColor
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import coil3.ImageLoader
import coil3.svg.SvgDecoder
import java.io.File
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.*

/** Shared review data is also read by the web screenshot harness. No server writes. */
class SheetUxPreviewTest {
    @Test
    fun sectionsRemainAvailableAcrossTheReviewWidth() {
        val instrument = InstrumentationRegistry.getInstrumentation()
        val width = InstrumentationRegistry.getArguments().getString("previewWidth")?.toInt() ?: 834
        val format = if (width < 600) LayoutFormat.Phone else if (width < 1200) LayoutFormat.Tablet else LayoutFormat.Wide
        val json = WireJson.parseToJsonElement(DATA).jsonObject
        val sheet = CharacterSheet("DND5", 1, json, version = 1)
        val images = ImageLoader.Builder(instrument.targetContext).components { add(SvgDecoder.Factory()) }.build()
        val context = SheetContext(sheet, HandbookMetadata(), emptyMap(), images, true, {}, {}, DndDerivedValues(sheet, emptyMap()), SheetJournalState())
        val sections = sheetSections("DND5", format)
        var selected by mutableStateOf(sections.first())
        try {
            ActivityScenario.launch(ComponentActivity::class.java).use { scenario ->
                scenario.onActivity { host -> host.setContent {
                    ShareTheme {
                        CompositionLocalProvider(LocalCharacterSheet provides context, LocalDensity provides Density(1f, 1f), LocalContentColor provides WebPalette.Text) {
                            Column(Modifier.fillMaxSize().semantics { contentDescription = "Обзор: ${selected.name}" }.shareCanvas().windowInsetsPadding(WindowInsets.safeDrawing)) {
                                CharacterSheetHeader(sheet, format, sections, selected, images, { selected = it }, {}, navigationInHeader = false,
                                    heading = { DndHeading(context) },
                                    actions = {
                                        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                                            DndHeaderTools(format == LayoutFormat.Phone, true, {}, {})
                                            SheetSessionBadge("Пепельная корона", SessionConnection.Connected, 2, 0, {}, {}, {})
                                        }
                                    })
                                if (format != LayoutFormat.Wide) DndSummaryStrip()
                                if (format != LayoutFormat.Wide) ShareSubheader(surfaceColor = WebPalette.Raised, cornerRadius = DesignTokens.Radius.Tile, horizontalInset = DesignTokens.Spacing.Page, contentPadding = PaddingValues(0.dp)) { SheetNavigation(sections, selected, images, { selected = it }, compact = format == LayoutFormat.Phone, pill = true) }
                                key(selected) {
                                    if (format == LayoutFormat.Wide) Box(Modifier.weight(1f)) { DndWideSheet(selected, sections, { selected = it }) }
                                    else Column(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                                        DndSheetSection(selected, format)
                                    }
                                }
                            }
                        }
                    }
                } }
                for (section in sections) {
                    scenario.onActivity { selected = section }
                    instrument.waitForIdleSync()
                    TouchRobot.await(section.title) { TouchRobot.find("Обзор: ${section.name}") != null }
                    android.os.SystemClock.sleep(650)
                    if (InstrumentationRegistry.getArguments().getString("captureSheetUx") == "true") {
                        instrument.uiAutomation.waitForIdle(350, 5_000)
                        val screenshot = requireNotNull(instrument.uiAutomation.takeScreenshot())
                        try {
                            File(instrument.targetContext.getExternalFilesDir(null), "sheet-$width-${section.name}.png").outputStream().use {
                                screenshot.compress(Bitmap.CompressFormat.PNG, 100, it)
                            }
                        } finally { screenshot.recycle() }
                    }
                }
            }
        } finally { images.shutdown() }
    }

    companion object {
        const val DATA = """{"values":{"name":"Лира","race":{"name":"Полуэльф"},"classes":[{"name":"Плут","level":3}],"hp":{"current":18,"max":{"base":23,"bonuses":[]},"temp":0,"hitDice":[]},"lvl":{"level":3,"exp":700},"prof_bonus":{"v":2,"auto":true},"speed":{"base":30,"bonuses":[]},"armor":{"bonuses":[]},"initiative":{"base":0,"use_dex":true,"bonuses":[]},"STR":{"value":{"base":10}},"DEX":{"value":{"base":16},"skills":{"4":{"up":2}}},"CON":{"value":{"base":14}},"INT":{"value":{"base":12}},"WIS":{"value":{"base":10}},"CHA":{"value":{"base":14}},"items":{"equipped":[],"sections":[{"id":"bag","name":"Рюкзак","items":[{"uid":"rope","count":2,"override":{"name":"Верёвка"}},{"uid":"torch","count":3,"override":{"name":"Факел"}}],"slots":{"rope":0,"torch":1}}]},"spells":{"schema_version":2,"slot_pools":{"long_rest":[{"level":1,"total":3,"used":1}],"short_rest":[]},"tabs":[{"key":"book","name":"Книга магии","casting_ability":4,"mode":"known","spells":[]}],"grants":[]},"states":[],"exhaustion":{"level":0}},"var":{"stats":{"1":0,"2":3,"3":2,"4":1,"5":0,"6":2}}}"""
    }
}

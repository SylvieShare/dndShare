package ru.dndshare.client.benchmark

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.room3.Room
import coil3.ImageLoader
import kotlinx.coroutines.delay
import ru.dndshare.client.character.*
import ru.dndshare.client.data.ClientDatabase
import ru.dndshare.client.data.buildDatabase
import ru.dndshare.client.ui.DndTheme
import ru.dndshare.client.ui.LayoutFormat
import ru.dndshare.client.ui.character.*
import ru.dndshare.client.ui.designsystem.ShareMorphRoot

private class SkillFixture(app: Context, initial: CharacterSheet) : ViewModel() {
    val db = buildDatabase(Room.inMemoryDatabaseBuilder<ClientDatabase>(app))
    val endpoint = object : CharacterSheetApi {
        @Volatile private var latest = initial
        override suspend fun character(uuid: String) = latest
        override suspend fun saveCharacter(uuid: String, packet: SheetPacket): SheetChange {
            delay(450)
            val before = latest
            latest = before.copy(version = before.version + 1, data = applySheetPatches(before.data, packet.patches))
            return SheetChange(before.version, latest.version, packet.mutationId, packet.patches)
        }
    }
    val sheets = CharacterSheetRepository(endpoint, db.characterSheets(), initial.userId)
    val images = ImageLoader.Builder(app).build()
    override fun onCleared() {
        sheets.close()
        images.shutdown()
        db.close()
    }
}

/** Real sheet, Room outbox and autosave. Only the remote endpoint is synthetic. */
internal fun ComponentActivity.showLiveSkillBenchmark(initial: CharacterSheet) {
    setContent {
        val fixture = viewModel<SkillFixture> { SkillFixture(applicationContext, initial) }
        val model = viewModel<CharacterSheetViewModel> {
            CharacterSheetViewModel(
                "benchmark", initial.userId, initial.sourceId, fixture.sheets, fixture.db.cache(), fixture.db.characterSheets(),
                SheetServices({}, {}), SavedStateHandle(), initialSection = SheetSection.Stats.name,
            )
        }
        val ui by model.uiState.collectAsState()
        DndTheme {
            ShareMorphRoot {
                BoxWithConstraints(Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing)) {
                    val format = when {
                        maxWidth.value >= 1200 -> LayoutFormat.Wide
                        maxWidth.value >= 600 -> LayoutFormat.Tablet
                        else -> LayoutFormat.Phone
                    }
                    CharacterSheetScreen(ui, model, initial.userId, fixture.db.cache(), format, fixture.images, true, ::finish)
                }
            }
        }
    }
}

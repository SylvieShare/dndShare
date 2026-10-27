package ru.dndshare.client

import android.content.Context
import androidx.lifecycle.*
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.room3.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Test
import org.junit.runner.RunWith
import ru.dndshare.client.character.*
import ru.dndshare.client.data.*
import ru.dndshare.client.ui.character.*
import kotlin.test.*

@RunWith(AndroidJUnit4::class)
class SheetViewModelStateTest {
    private class Owner : ViewModelStoreOwner { override val viewModelStore = ViewModelStore() }

    @Test fun newViewModelRestoresNavigationAndTheOriginalOpenForm() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val database = buildDatabase(Room.inMemoryDatabaseBuilder<ClientDatabase>(context))
        val api = SheetStateServer()
        val sheets = CharacterSheetRepository(api, database.characterSheets(), 1)
        val owners = mutableListOf<Owner>()
        suspend fun model(handle: SavedStateHandle): CharacterSheetViewModel = withContext(Dispatchers.Main) {
            val owner = Owner().also(owners::add)
            val factory = viewModelFactory { initializer {
                CharacterSheetViewModel("hero", 1, 1, sheets, database.cache(), database.characterSheets(), SheetServices({}, {}), handle)
            } }
            ViewModelProvider(owner, factory)[CharacterSheetViewModel::class.java]
        }
        try {
            database.cache().upsertState(SyncState(1, ready = true))
            val saved = SavedStateHandle()
            val first = model(saved)
            withTimeout(10_000) { first.uiState.first { it.sheet != null } }
            withContext(Dispatchers.Main) {
                first.selectSection(SheetSection.Spells)
                first.openItem(11)
                first.edit("hp")
            }
            withTimeout(10_000) { first.uiState.first { it.editor != null } }
            withContext(Dispatchers.Main) { first.number(SheetNumberField.Current, "7") }
            val input = withTimeout(10_000) { first.uiState.first { it.editor?.fields?.number == "7" } }
            assertEquals(SheetSection.Spells.name, input.navigation.sectionName)
            val restoredHandle = withContext(Dispatchers.Main) {
                SavedStateHandle(saved.keys().associateWith { saved.get<Any?>(it) }).also { owners.first().viewModelStore.clear() }
            }
            api.remote(sheetPath("values", "hp", "current"), JsonPrimitive(3))
            sheets.refresh("hero")
            val restored = model(restoredHandle)
            val state = withTimeout(10_000) { restored.uiState.first { it.editor != null && it.sheet?.version == 2L } }
            assertEquals("7", state.editor?.fields?.number)
            assertEquals(1L, state.editor?.baseline?.version)
            assertEquals(SheetSection.Spells.name, state.navigation.sectionName)
            assertEquals(listOf(11L), state.navigation.itemStack)
            withContext(Dispatchers.Main) { restored.submitEditor() }
            withTimeout(10_000) { restored.uiState.first { it.editor?.fields?.error != null } }
            assertTrue(api.packets.isEmpty())
        } finally {
            withContext(Dispatchers.Main) { owners.forEach { it.viewModelStore.clear() } }
            sheets.closeAndJoin(); database.close()
        }
    }
}

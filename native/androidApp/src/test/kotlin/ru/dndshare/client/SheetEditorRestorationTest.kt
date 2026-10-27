package ru.dndshare.client

import androidx.lifecycle.SavedStateHandle
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import kotlin.test.*
import ru.dndshare.client.character.*
import ru.dndshare.client.ui.character.*

@OptIn(ExperimentalCoroutinesApi::class)
class SheetEditorRestorationTest {
    private fun recreated(handle: SavedStateHandle) = SavedStateHandle(handle.keys().associateWith { handle.get<Any?>(it) })

    @Test fun restoredInputUsesItsOriginalBaselineAndBlocksANewerRemoteValue() = runTest {
        val api = SheetStateServer(); val cache = MemorySheetForms(); val saved = SavedStateHandle()
        val sheets = CharacterSheetRepository(api, cache, 1, backgroundScope)
        sheets.refresh("hero")
        val first = SheetEditorController("hero", 1, saved, cache, sheets, backgroundScope, StandardTestDispatcher(testScheduler))
        runCurrent(); first.open("hp", api.sheet); runCurrent()
        first.number(SheetNumberField.Current, "7")
        api.remote(sheetPath("values", "hp", "current"), JsonPrimitive(3))
        sheets.refresh("hero"); runCurrent()
        val restored = SheetEditorController("hero", 1, recreated(saved), cache, sheets, backgroundScope, StandardTestDispatcher(testScheduler))
        runCurrent()
        assertEquals("7", restored.state.value?.fields?.number)
        assertEquals(1L, restored.state.value?.baseline?.version)
        restored.submit(emptyMap()); runCurrent()
        assertNotNull(restored.state.value?.fields?.error)
        assertEquals("7", restored.state.value?.fields?.number)
        assertEquals(JsonPrimitive(3), sheetValue(api.sheet.data, sheetPath("values", "hp", "current")))
        assertTrue(api.packets.isEmpty())
    }

    @Test fun unrelatedChangesSurviveRestoredSubmissionAndTheFormIsConsumed() = runTest {
        val api = SheetStateServer(); val cache = MemorySheetForms(); val saved = SavedStateHandle()
        val sheets = CharacterSheetRepository(api, cache, 1, backgroundScope)
        sheets.refresh("hero")
        val first = SheetEditorController("hero", 1, saved, cache, sheets, backgroundScope, StandardTestDispatcher(testScheduler))
        runCurrent(); first.open("hp", api.sheet); runCurrent()
        first.number(SheetNumberField.Current, "7")
        api.remote(sheetPath("values", "name"), JsonPrimitive("Торин"))
        sheets.refresh("hero"); runCurrent()
        val restoredHandle = recreated(saved)
        val restored = SheetEditorController("hero", 1, restoredHandle, cache, sheets, backgroundScope, StandardTestDispatcher(testScheduler))
        runCurrent(); restored.submit(emptyMap()); runCurrent()
        assertEquals("Торин", api.sheet.name)
        assertEquals(JsonPrimitive(7), sheetValue(api.sheet.data, sheetPath("values", "hp", "current")))
        assertNull(restored.state.value)
        assertNull(restoredHandle.get<String>(SheetEditorController.KEY))
        assertTrue(cache.forms.isEmpty())
    }

    @Test fun staleSavedUiCannotSubmitAnAcceptedFormAgainAfterProcessDeath() = runTest {
        val api = SheetStateServer(); val cache = MemorySheetForms(); val saved = SavedStateHandle()
        val firstScope = CoroutineScope(SupervisorJob() + StandardTestDispatcher(testScheduler))
        val sheets = CharacterSheetRepository(api, cache, 1, firstScope)
        sheets.refresh("hero")
        val editor = SheetEditorController("hero", 1, saved, cache, sheets, firstScope, StandardTestDispatcher(testScheduler))
        runCurrent(); editor.open("hp", api.sheet); runCurrent()
        editor.number(SheetNumberField.Current, "7")
        val stoppedUi = recreated(saved)
        api.dropResponse = true
        editor.submit(emptyMap()); runCurrent()
        sheets.closeAndJoin()
        val next = CharacterSheetRepository(api, cache, 1, backgroundScope)
        val restored = SheetEditorController("hero", 1, stoppedUi, cache, next, backgroundScope, StandardTestDispatcher(testScheduler))
        next.resume(); runCurrent()
        assertNull(restored.state.value)
        assertNull(stoppedUi.get<String>(SheetEditorController.KEY))
        assertEquals(1, api.accepted.size)
        assertEquals(api.packets.first(), api.packets.last())
    }

    @Test fun savedStateContainsSmallInputsWhileALargeBaselineStaysInTheDatabase() = runTest {
        val api = SheetStateServer(); val cache = MemorySheetForms(); val saved = SavedStateHandle()
        api.remote(sheetPath("values", "notes"), JsonPrimitive("Большая история".repeat(100_000)))
        val sheets = CharacterSheetRepository(api, cache, 1, backgroundScope)
        sheets.refresh("hero")
        val editor = SheetEditorController("hero", 1, saved, cache, sheets, backgroundScope, StandardTestDispatcher(testScheduler))
        runCurrent(); editor.open("hp", api.sheet); runCurrent()
        editor.number(SheetNumberField.Current, "")
        assertTrue(requireNotNull(saved.get<String>(SheetEditorController.KEY)).length < 2_000)
        val restored = SheetEditorController("hero", 1, recreated(saved), cache, sheets, backgroundScope, StandardTestDispatcher(testScheduler))
        runCurrent(); restored.submit(emptyMap()); runCurrent()
        assertEquals("", restored.state.value?.fields?.number)
        assertNotNull(restored.state.value?.fields?.error)
        assertTrue(api.packets.isEmpty())
        restored.dismiss(); runCurrent()
        assertTrue(cache.forms.isEmpty())
    }
}

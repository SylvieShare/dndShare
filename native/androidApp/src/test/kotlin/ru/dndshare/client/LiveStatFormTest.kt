package ru.dndshare.client

import androidx.lifecycle.SavedStateHandle
import kotlin.test.*
import kotlinx.coroutines.*
import kotlinx.coroutines.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.character.*

@OptIn(ExperimentalCoroutinesApi::class)
class LiveStatFormTest {
    @Test
    fun rapidInputCommitsWithoutClosingAndCheckpointAdvances() = runTest {
        val api = SheetStateServer()
        val cache = MemorySheetForms()
        val repo = CharacterSheetRepository(api, cache, 1, backgroundScope)
        repo.refresh("hero")
        val editor =
            SheetEditorController(
                "hero",
                1,
                SavedStateHandle(),
                cache,
                repo,
                backgroundScope,
                StandardTestDispatcher(testScheduler),
            )
        editor.liveContext = { LiveStatContext(emptyMap(), HandbookMetadata(), null) }
        runCurrent()
        editor.open("STR", api.sheet)
        runCurrent()
        advanceTimeBy(150)
        runCurrent()
        assertTrue(api.packets.isEmpty(), "Opening is not a mutation")
        for (value in listOf("1", "15", "18")) editor.number(SheetNumberField.Current, value)
        runCurrent()
        advanceTimeBy(160)
        runCurrent()
        assertEquals(
            18,
            repo
                .local("hero")!!
                .displayed
                .values["STR"]
                .objectValue()["value"]
                .objectValue()["base"]
                .number(),
        )
        assertEquals("18", editor.state.value!!.fields.number)
        assertEquals(
            18,
            editor.state.value!!
                .baseline
                .values["STR"]
                .objectValue()["value"]
                .objectValue()["base"]
                .number(),
        )
        assertEquals(1, cache.forms.size)
        editor.number(SheetNumberField.Current, "19")
        runCurrent()
        editor.dismiss()
        runCurrent()
        assertNull(editor.state.value)
        assertTrue(cache.forms.isEmpty())
        assertEquals(
            19,
            repo
                .local("hero")!!
                .displayed
                .values["STR"]
                .objectValue()["value"]
                .objectValue()["base"]
                .number(),
        )
    }

    @Test
    fun invalidIntermediateValueRemainsARestorableDraft() = runTest {
        val api = SheetStateServer()
        val cache = MemorySheetForms()
        val repo = CharacterSheetRepository(api, cache, 1, backgroundScope)
        repo.refresh("hero")
        val editor =
            SheetEditorController(
                "hero",
                1,
                SavedStateHandle(),
                cache,
                repo,
                backgroundScope,
                StandardTestDispatcher(testScheduler),
            )
        editor.liveContext = { LiveStatContext(emptyMap(), HandbookMetadata(), null) }
        runCurrent()
        editor.open("STR", api.sheet)
        runCurrent()
        editor.number(SheetNumberField.Current, "")
        editor.input("save_up", JsonPrimitive(true))
        runCurrent()
        advanceTimeBy(160)
        runCurrent()
        assertNotNull(editor.state.value!!.fields.error)
        editor.dismiss()
        runCurrent()
        assertNull(editor.state.value)
        assertEquals(1, cache.forms.size)
        editor.open("STR", repo.local("hero")!!.displayed)
        runCurrent()
        assertEquals("", editor.state.value!!.fields.number)
        editor.number(SheetNumberField.Current, "14")
        runCurrent()
        advanceTimeBy(160)
        runCurrent()
        assertEquals(
            14,
            repo
                .local("hero")!!
                .displayed
                .values["STR"]
                .objectValue()["value"]
                .objectValue()["base"]
                .number(),
        )
        assertEquals(
            JsonPrimitive(true),
            repo.local("hero")!!.displayed.values["STR"].objectValue()["save_up"],
        )
    }

    @Test
    fun newerRemoteValueIsNotOverwrittenAndDraftCanClose() = runTest {
        val api = SheetStateServer()
        val cache = MemorySheetForms()
        val repo = CharacterSheetRepository(api, cache, 1, backgroundScope)
        repo.refresh("hero")
        val editor =
            SheetEditorController(
                "hero",
                1,
                SavedStateHandle(),
                cache,
                repo,
                backgroundScope,
                StandardTestDispatcher(testScheduler),
            )
        editor.liveContext = { LiveStatContext(emptyMap(), HandbookMetadata(), null) }
        runCurrent()
        editor.open("STR", api.sheet)
        runCurrent()
        api.remote(sheetPath("values", "STR", "value", "base"), JsonPrimitive(17))
        repo.refresh("hero")
        editor.number(SheetNumberField.Current, "16")
        runCurrent()
        advanceTimeBy(160)
        runCurrent()
        assertNotNull(editor.state.value!!.fields.error)
        editor.dismiss()
        runCurrent()
        assertNull(editor.state.value)
        assertEquals(1, cache.forms.size)
        assertEquals(
            17,
            api.sheet.values["STR"].objectValue()["value"].objectValue()["base"].number(),
        )
        editor.discardDrafts()
        assertTrue(cache.forms.isEmpty())
    }
}

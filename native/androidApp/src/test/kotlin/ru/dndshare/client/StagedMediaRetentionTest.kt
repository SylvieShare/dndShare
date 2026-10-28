package ru.dndshare.client

import java.io.File
import java.nio.file.Files
import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*

class StagedMediaRetentionTest {
    @Test
    fun nestedEncryptedBackupReferencesAndFreshFilesSurviveCleanup() {
        val folder = Files.createTempDirectory("native-staged-media").toFile()
        try {
            val now = System.currentTimeMillis()
            fun file(name: String, old: Boolean = true) =
                File(folder, name).apply {
                    writeText("image")
                    setLastModified(now - if (old) 3 * 24 * 60 * 60 * 1000L else 1000)
                }
            val protected = file("protected.png")
            val fresh = file("unfinished.png", false)
            val orphan = file("orphan.webp")
            val input = buildJsonObject { put("path", protected.path) }.toString()
            val records =
                listOf(
                    buildJsonObject {
                            put(
                                "forms",
                                buildJsonArray { add(buildJsonObject { put("inputs", input) }) },
                            )
                        }
                        .toString()
                )
            assertEquals(1, pruneStagedMedia(folder, retainedMediaPaths(records), now))
            assertTrue(protected.exists())
            assertTrue(fresh.exists())
            assertFalse(orphan.exists())
            assertEquals(0, pruneStagedMedia(folder, retainedMediaPaths(records), now))
        } finally {
            folder.deleteRecursively()
        }
    }

    @Test
    fun unreadableRecordRejectsCleanupRatherThanGuessingItsReferences() {
        assertFails { retainedMediaPaths(listOf("{broken")) }
    }
}

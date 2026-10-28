package ru.dndshare.client

import android.content.Context
import androidx.room3.Room
import androidx.test.core.app.ApplicationProvider
import kotlin.test.*
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.encodeToString
import org.junit.Test
import ru.dndshare.client.data.*
import ru.dndshare.client.model.*

class CharacterSourceScopeTest {
    @Test
    fun localEditionAndBookRulesMatchServerPrivateAndUnassignedSemantics() = runTest {
        val context = ApplicationProvider.getApplicationContext<Context>()
        val db = buildDatabase(Room.inMemoryDatabaseBuilder<ClientDatabase>(context))
        try {
            val definitions =
                listOf(
                    CatalogueItem(
                        1,
                        5,
                        "A",
                        compatibility = listOf(Compatibility(1, "native")),
                        contentSources = listOf(Book(1, "Book A")),
                    ),
                    CatalogueItem(
                        2,
                        5,
                        "B",
                        compatibility = listOf(Compatibility(1, "native")),
                        contentSources = listOf(Book(2, "Book B")),
                    ),
                    CatalogueItem(
                        3,
                        5,
                        "Private",
                        userId = 7,
                        compatibility = listOf(Compatibility(1, "native")),
                        contentSources = listOf(Book(2, "Book B")),
                    ),
                    CatalogueItem(
                        4,
                        5,
                        "Unassigned",
                        compatibility = listOf(Compatibility(1, "native")),
                    ),
                    CatalogueItem(
                        5,
                        5,
                        "Legacy",
                        compatibility = listOf(Compatibility(1, "legacy")),
                        contentSources = listOf(Book(1, "Book A")),
                    ),
                    CatalogueItem(
                        6,
                        5,
                        "Other edition",
                        compatibility = listOf(Compatibility(2, "native")),
                        contentSources = listOf(Book(1, "Book A")),
                    ),
                )
            db.cache()
                .upsertItems(
                    definitions.map { item ->
                        CachedItem(
                            1,
                            item.id,
                            item.typeId,
                            item.name,
                            "",
                            item.name.lowercase(),
                            item.editionKeys(),
                            false,
                            1,
                            WireJson.encodeToString(item),
                        )
                    }
                )
            suspend fun ids(legacy: Boolean, restricted: Boolean, books: String) =
                db.cache()
                    .observeCharacterItems(1, 5, 1, legacy, restricted, books, "%", 100)
                    .first()
                    .map { it.id }
                    .toSet()
            assertEquals(setOf(1L, 3L, 4L), ids(false, true, "[1]"))
            assertEquals(setOf(1L, 3L, 4L, 5L), ids(true, true, "[1]"))
            assertEquals(setOf(3L, 4L), ids(false, true, "[]"))
            assertEquals(setOf(1L, 2L, 3L, 4L), ids(false, false, "[]"))
        } finally {
            db.close()
        }
    }
}

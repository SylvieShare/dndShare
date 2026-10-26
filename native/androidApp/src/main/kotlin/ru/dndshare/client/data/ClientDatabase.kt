package ru.dndshare.client.data

import androidx.room3.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import androidx.sqlite.driver.bundled.BundledSQLiteDriver

@Entity(tableName = "catalogue_items", primaryKeys = ["sourceId", "id"])
data class CachedItem(
    val sourceId: Long, val id: Long, val typeId: Long, val name: String,
    val nameEn: String, val searchText: String, val editionKeys: String,
    val hidden: Boolean, val revision: Long, val payload: String,
)

data class ItemSummary(val id: Long, val typeId: Long, val name: String, val nameEn: String, val payload: String = "{}")
data class TypeCount(val typeId: Long, val count: Int)
data class RemovedItem(val id: Long, val revision: Long)

@Entity(tableName = "catalogue_metadata")
data class CachedMetadata(@PrimaryKey val sourceId: Long, val payload: String)

@Entity(tableName = "catalogue_sync")
data class SyncState(
    @PrimaryKey val sourceId: Long,
    val cursor: String? = null, val resumeCursor: String? = null,
    val lastSyncedAt: String? = null, val ready: Boolean = false,
)

@Entity(tableName = "characters")
data class CachedCharacter(@PrimaryKey val id: Long, val payload: String)

private const val CATALOGUE_WHERE = """
        WHERE sourceId=:sourceId AND NOT hidden
        AND (:typeId IS NULL OR typeId=:typeId)
        AND (:editionKey='' OR editionKeys LIKE :editionKey)
        AND searchText LIKE :query ESCAPE '\'
        AND (:books='[]' OR EXISTS (SELECT 1 FROM json_each(payload,'$.contentSources') b
            JOIN json_each(:books) chosen ON json_extract(b.value,'$.id')=chosen.value))
        AND NOT EXISTS (SELECT 1 FROM json_each(:filters) f WHERE NOT EXISTS (
            SELECT 1 FROM json_each(f.value) selected WHERE
                json_extract(payload,'$.data.'||f.key)=selected.value OR
                EXISTS (SELECT 1 FROM json_each(CASE WHEN json_type(payload,'$.data.'||f.key)='array'
                    THEN json_extract(payload,'$.data.'||f.key) ELSE '[]' END) v WHERE v.value=selected.value)))
"""

@Dao
abstract class CacheDao {
    @Query("SELECT id,typeId,name,nameEn,payload FROM catalogue_items " + CATALOGUE_WHERE + " ORDER BY name,id LIMIT :limit")
    abstract fun observeItems(sourceId: Long, typeId: Long?, editionKey: String, query: String, limit: Int, books: String = "[]", filters: String = "{}"): Flow<List<ItemSummary>>

    @Query("SELECT count(*) FROM catalogue_items " + CATALOGUE_WHERE)
    abstract fun observeFilteredCount(sourceId: Long, typeId: Long?, editionKey: String, query: String, books: String = "[]", filters: String = "{}"): Flow<Int>


    @Query("""SELECT typeId,count(*) AS count FROM catalogue_items
        WHERE sourceId=:sourceId AND NOT hidden
        AND (:editionKey='' OR editionKeys LIKE :editionKey) GROUP BY typeId""")
    abstract fun observeCounts(sourceId: Long, editionKey: String): Flow<List<TypeCount>>

    @Query("SELECT payload FROM catalogue_items WHERE sourceId=:sourceId AND id=:id")
    abstract fun observeItem(sourceId: Long, id: Long): Flow<String?>

    @Query("SELECT * FROM catalogue_metadata WHERE sourceId=:sourceId")
    abstract fun observeMetadata(sourceId: Long): Flow<CachedMetadata?>

    @Query("SELECT * FROM catalogue_sync WHERE sourceId=:sourceId")
    abstract fun observeSync(sourceId: Long): Flow<SyncState?>

    @Query("SELECT * FROM catalogue_sync WHERE sourceId=:sourceId")
    abstract suspend fun syncState(sourceId: Long): SyncState?

    @Query("SELECT id FROM catalogue_items WHERE sourceId=:sourceId")
    abstract suspend fun itemIds(sourceId: Long): List<Long>

    @Query("SELECT revision FROM catalogue_items WHERE sourceId=:sourceId AND id=:id")
    abstract suspend fun revision(sourceId: Long, id: Long): Long?

    @Upsert abstract suspend fun upsertItems(items: List<CachedItem>)
    @Upsert abstract suspend fun upsertMetadata(metadata: CachedMetadata)
    @Upsert abstract suspend fun upsertState(state: SyncState)

    @Query("DELETE FROM catalogue_items WHERE sourceId=:sourceId AND id IN (:ids)")
    abstract suspend fun removeItems(sourceId: Long, ids: List<Long>)

    @Query("SELECT * FROM characters ORDER BY id DESC")
    abstract fun observeCharacters(): Flow<List<CachedCharacter>>

    @Query("DELETE FROM characters")
    abstract suspend fun clearCharacters()
    @Upsert abstract suspend fun upsertCharacters(characters: List<CachedCharacter>)

    @Transaction
    open suspend fun replaceCharacters(characters: List<CachedCharacter>) {
        clearCharacters()
        upsertCharacters(characters)
    }

    @Transaction
    open suspend fun applyPage(
        sourceId: Long, updates: List<CachedItem>, removed: List<RemovedItem>,
        metadata: CachedMetadata?, state: SyncState, visibleIds: List<Long>?,
    ) {
        // Applying a page and advancing its cursor is one durable transaction.
        // Replayed/late responses cannot roll back a newer item revision.
        val fresh = updates.filter { it.revision >= (revision(sourceId, it.id) ?: -1) }
        if (fresh.isNotEmpty()) upsertItems(fresh)
        removed.filter { it.revision >= (revision(sourceId, it.id) ?: -1) }.map { it.id }
            .chunked(400).forEach { removeItems(sourceId, it) }
        if (metadata != null) upsertMetadata(metadata)
        if (visibleIds != null) {
            val visible = visibleIds.toHashSet()
            itemIds(sourceId).filterNot(visible::contains).chunked(400).forEach { removeItems(sourceId, it) }
        }
        upsertState(state)
    }
}

@Database(
    entities = [CachedItem::class, CachedMetadata::class, SyncState::class, CachedCharacter::class],
    version = 1, exportSchema = true,
)
abstract class ClientDatabase : RoomDatabase() {
    abstract fun cache(): CacheDao
}

fun buildDatabase(builder: RoomDatabase.Builder<ClientDatabase>): ClientDatabase =
    builder.setDriver(BundledSQLiteDriver()).setQueryCoroutineContext(Dispatchers.IO).build()

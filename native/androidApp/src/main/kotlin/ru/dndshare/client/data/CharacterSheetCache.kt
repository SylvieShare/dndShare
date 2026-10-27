package ru.dndshare.client.data

import androidx.room3.*
import androidx.room3.migration.Migration
import androidx.sqlite.SQLiteConnection
import androidx.sqlite.execSQL
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "character_sheets")
data class CachedCharacterSheet(@PrimaryKey val uuid: String, val payload: String, val draft: String = "{}")

@Entity(tableName = "character_sheet_sections", primaryKeys = ["uuid", "section"])
data class CachedSheetSection(val uuid: String, val section: String, val payload: String)

@Dao
interface CharacterSheetDao {
    @Query("SELECT payload FROM character_sheet_sections WHERE uuid=:uuid AND section=:section")
    fun observeSection(uuid: String, section: String): Flow<String?>
    @Upsert suspend fun putSection(section: CachedSheetSection)
    @Query("SELECT * FROM character_sheets WHERE uuid=:uuid")
    fun observe(uuid: String): Flow<CachedCharacterSheet?>
    @Query("SELECT * FROM character_sheets WHERE uuid=:uuid")
    suspend fun get(uuid: String): CachedCharacterSheet?
    @Query("SELECT uuid FROM character_sheets WHERE draft!='{}'")
    suspend fun pending(): List<String>
    @Upsert suspend fun put(sheet: CachedCharacterSheet)
}

val characterSheetsMigration = object : Migration(1, 2) {
    override suspend fun migrate(connection: SQLiteConnection) {
        connection.execSQL("CREATE TABLE IF NOT EXISTS character_sheets (uuid TEXT NOT NULL PRIMARY KEY, payload TEXT NOT NULL, draft TEXT NOT NULL)")
        connection.execSQL("CREATE TABLE IF NOT EXISTS character_sheet_sections (uuid TEXT NOT NULL, section TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(uuid, section))")
    }
}

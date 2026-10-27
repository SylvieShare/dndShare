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

@Entity(tableName = "character_sheet_forms", primaryKeys = ["uuid", "id"])
data class CachedSheetForm(val uuid: String, val id: String, val baseline: String)

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
    @Query("SELECT * FROM character_sheet_forms WHERE uuid=:uuid AND id=:id")
    suspend fun form(uuid: String, id: String): CachedSheetForm?
    @Upsert suspend fun putForm(form: CachedSheetForm)
    @Query("DELETE FROM character_sheet_forms WHERE uuid=:uuid AND id=:id")
    suspend fun removeForm(uuid: String, id: String)

    @Transaction
    suspend fun acceptForm(sheet: CachedCharacterSheet, id: String) {
        put(sheet)
        removeForm(sheet.uuid, id)
    }
}

val characterFormsMigration = object : Migration(2, 3) {
    override suspend fun migrate(connection: SQLiteConnection) {
        connection.execSQL("CREATE TABLE IF NOT EXISTS character_sheet_forms (uuid TEXT NOT NULL, id TEXT NOT NULL, baseline TEXT NOT NULL, PRIMARY KEY(uuid, id))")
    }
}

val characterSheetsMigration = object : Migration(1, 2) {
    override suspend fun migrate(connection: SQLiteConnection) {
        connection.execSQL("CREATE TABLE IF NOT EXISTS character_sheets (uuid TEXT NOT NULL PRIMARY KEY, payload TEXT NOT NULL, draft TEXT NOT NULL)")
        connection.execSQL("CREATE TABLE IF NOT EXISTS character_sheet_sections (uuid TEXT NOT NULL, section TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(uuid, section))")
    }
}

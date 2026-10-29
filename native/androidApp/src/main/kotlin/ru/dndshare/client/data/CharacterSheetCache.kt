package ru.dndshare.client.data

import androidx.room3.*
import androidx.room3.migration.Migration
import androidx.sqlite.SQLiteConnection
import androidx.sqlite.execSQL
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "character_sheets")
data class CachedCharacterSheet(
    @PrimaryKey val uuid: String,
    val payload: String,
    val draft: String = "{}",
)

@Entity(tableName = "character_sheet_sections", primaryKeys = ["uuid", "section"])
@kotlinx.serialization.Serializable
data class CachedSheetSection(val uuid: String, val section: String, val payload: String)

@Entity(tableName = "character_sheet_forms", primaryKeys = ["uuid", "id"])
@kotlinx.serialization.Serializable
data class CachedSheetForm(
    val uuid: String,
    val id: String,
    val baseline: String,
    @ColumnInfo(defaultValue = "'{}'") val inputs: String = "{}",
)

@Dao
interface CharacterSheetDao {
    @Query("SELECT payload FROM character_sheet_sections WHERE uuid=:uuid AND section=:section")
    fun observeSection(uuid: String, section: String): Flow<String?>

    @Upsert suspend fun putSection(section: CachedSheetSection)

    @Query(
        "SELECT * FROM character_sheet_sections WHERE section='remote-command' AND payload!='{}'"
    )
    suspend fun pendingCommands(): List<CachedSheetSection>

    @Transaction
    suspend fun acceptCommand(
        section: CachedSheetSection,
        formId: String?,
        receipt: CachedSheetSection? = null,
    ) {
        if (receipt != null) {
            require(receipt.uuid == section.uuid)
            putSection(receipt)
        }
        putSection(section)
        if (formId != null) removeForm(section.uuid, formId)
    }

    @Transaction
    suspend fun acceptSection(sheet: CachedCharacterSheet, section: CachedSheetSection) {
        require(sheet.uuid == section.uuid)
        put(sheet)
        putSection(section)
    }

    @Query("SELECT * FROM character_sheets WHERE uuid=:uuid")
    fun observe(uuid: String): Flow<CachedCharacterSheet?>

    @Query("SELECT * FROM character_sheets WHERE uuid=:uuid")
    suspend fun get(uuid: String): CachedCharacterSheet?

    @Query(
        """SELECT uuid FROM character_sheets
        WHERE COALESCE(json_array_length(draft,'$.edits'),0)>0
        OR json_type(draft,'$.sending')='object' OR json_type(draft,'$.blocked')='text'"""
    )
    suspend fun pending(): List<String>

    @Upsert suspend fun put(sheet: CachedCharacterSheet)

    @Query("SELECT * FROM character_sheet_forms WHERE uuid=:uuid AND id=:id")
    suspend fun form(uuid: String, id: String): CachedSheetForm?

    @Query("SELECT * FROM character_sheet_forms") suspend fun openForms(): List<CachedSheetForm>

    @Upsert suspend fun putForm(form: CachedSheetForm)

    @Query("UPDATE character_sheet_forms SET inputs=:inputs WHERE uuid=:uuid AND id=:id")
    suspend fun updateFormInputs(uuid: String, id: String, inputs: String): Int

    @Query("DELETE FROM character_sheet_forms WHERE uuid=:uuid AND id=:id")
    suspend fun removeForm(uuid: String, id: String)

    @Query("UPDATE character_sheet_forms SET baseline=:baseline WHERE uuid=:uuid AND id=:id")
    suspend fun updateFormBaseline(uuid: String, id: String, baseline: String): Int

    @Transaction
    suspend fun checkpointForm(sheet: CachedCharacterSheet, form: CachedSheetForm) {
        require(sheet.uuid == form.uuid)
        put(sheet)
        // Preserve the newest input writer, including edits made during this transaction.
        updateFormBaseline(form.uuid, form.id, form.baseline)
    }

    @Transaction
    suspend fun acceptForm(sheet: CachedCharacterSheet, id: String) {
        put(sheet)
        removeForm(sheet.uuid, id)
    }
}

val characterFormInputsMigration =
    object : Migration(3, 4) {
        override suspend fun migrate(connection: SQLiteConnection) {
            connection.execSQL(
                "ALTER TABLE character_sheet_forms ADD COLUMN inputs TEXT NOT NULL DEFAULT '{}'"
            )
            // Cached payloads previously omitted item ownership. Rehydrate them without deleting
            // offline rows.
            connection.execSQL("UPDATE catalogue_sync SET cursor=NULL,resumeCursor=NULL,ready=0")
        }
    }

val characterFormsMigration =
    object : Migration(2, 3) {
        override suspend fun migrate(connection: SQLiteConnection) {
            connection.execSQL(
                "CREATE TABLE IF NOT EXISTS character_sheet_forms (uuid TEXT NOT NULL, id TEXT NOT NULL, baseline TEXT NOT NULL, PRIMARY KEY(uuid, id))"
            )
        }
    }

val characterSheetsMigration =
    object : Migration(1, 2) {
        override suspend fun migrate(connection: SQLiteConnection) {
            connection.execSQL(
                "CREATE TABLE IF NOT EXISTS character_sheets (uuid TEXT NOT NULL PRIMARY KEY, payload TEXT NOT NULL, draft TEXT NOT NULL)"
            )
            connection.execSQL(
                "CREATE TABLE IF NOT EXISTS character_sheet_sections (uuid TEXT NOT NULL, section TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(uuid, section))"
            )
        }
    }

package ru.dndshare.client.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*

val WireJson = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
}

@Serializable
data class GameContext(
    val sourceId: Long = 0,
    val sourceName: String = "",
    val sourceVersionId: Long = 0,
    val version: String = "",
)

@Serializable
data class User(
    val id: Long,
    val login: String,
    val roles: List<String> = emptyList(),
    val gameContext: GameContext = GameContext(),
    val hasCharacters: Boolean = false,
)

@Serializable data class AuthReply(val auth: Boolean, val user: User? = null)

@Serializable data class Edition(val id: Long, val sourceId: Long = 0, val version: String)

@Serializable
data class GameSource(val id: Long, val name: String, val versions: List<Edition> = emptyList())

@Serializable data class SourcesReply(val sources: List<GameSource> = emptyList())

@Serializable
data class ItemType(
    val id: Long,
    val name: String,
    val parentTypeId: Long? = null,
    val fields: JsonElement = JsonArray(emptyList()),
    val color: String? = null,
    val important: Boolean = false,
    val description: String? = null,
    val iconImageUrl: String? = null,
    val coverImageUrl: String? = null,
)

@Serializable
data class Suggest(
    val id: Long,
    val typeId: Long,
    val value: String,
    val desc: String? = null,
    val color: String? = null,
    val svg: String? = null,
    val iconImageUrl: String? = null,
)

@Serializable
data class SuggestType(
    val id: Long,
    val name: String,
    val color: String? = null,
    val svg: String? = null,
)

@Serializable data class Book(val id: Long, val name: String, val code: String = "")

@Serializable data class Compatibility(val sourceVersionId: Long, val status: String)

@OptIn(kotlinx.serialization.ExperimentalSerializationApi::class)
@Serializable
data class CatalogueItem(
    val id: Long,
    val typeId: Long,
    val name: String,
    val nameEn: String? = null,
    val data: JsonObject = JsonObject(emptyMap()),
    val hidden: Boolean = false,
    val userId: Long? = null,
    val changedAt: String = "",
    val iconImageUrl: String? = null,
    val coverImageUrl: String? = null,
    val contentSources: List<Book> = emptyList(),
    val compatibility: List<Compatibility> = emptyList(),
    @kotlinx.serialization.EncodeDefault val svg: String? = null,
) {
    fun editionKeys(): String =
        compatibility
            .filter { it.status == "native" || it.status == "compatible" }
            .joinToString("", prefix = "|") { it.sourceVersionId.toString() + "|" }
}

@Serializable
data class HandbookMetadata(
    val types: List<ItemType> = emptyList(),
    val suggestTypes: List<SuggestType> = emptyList(),
    val suggests: Map<String, List<Suggest>> = emptyMap(),
    val books: List<Book> = emptyList(),
) {
    fun suggest(id: Long, typeId: Long? = null): Suggest? =
        if (typeId != null) suggests[typeId.toString()]?.firstOrNull { it.id == id }
        else suggests.values.asSequence().flatten().filter { it.id == id }.singleOrNull()
}

@Serializable
data class SyncEntry(
    val id: Long,
    val revision: Long,
    val changedAt: String,
    val deleted: Boolean,
    val item: CatalogueItem? = null,
)

@Serializable
data class SyncPage(
    val protocol: Int,
    val entries: List<SyncEntry> = emptyList(),
    val metadata: HandbookMetadata? = null,
    val full: Boolean = false,
    val hasMore: Boolean,
    val nextCursor: String? = null,
    val cursor: String? = null,
    val visibleIds: List<Long>? = null,
    val serverTime: String,
)

@Serializable
data class Character(
    val id: Long,
    val uuid: String,
    val data: JsonObject,
    val sourceName: String? = null,
    val sourceVersion: String? = null,
    val iconImageUrl: String? = null,
    val userId: Long = 0,
    val templateId: Long = 0,
    val sourceId: Long? = null,
    val sourceVersionId: Long? = null,
    val publicVisible: Boolean = false,
    val version: Long = 0,
    val changedAt: String = "",
    val sessions: List<CharacterSession> = emptyList(),
) {
    private val values
        get() = data["values"] as? JsonObject ?: JsonObject(emptyMap())

    val name
        get() = values.text("name").ifBlank { values.text("char_name") }.ifBlank { "Без имени" }

    val level
        get() = (values["lvl"] as? JsonObject)?.text("level").orEmpty().ifBlank { "—" }

    val subtitle
        get() = listOfNotNull(sourceName, sourceVersion).joinToString(" · ")
}

@Serializable
data class CharactersReply(
    val chars: List<Character> = emptyList(),
    val sessionsByChar: Map<String, List<CharacterSession>> = emptyMap(),
)

@Serializable
data class CharacterSession(
    val uuid: String,
    val name: String,
    val isGm: Boolean = false,
    val chapterNumber: String? = null,
    val chapterName: String? = null,
    val arcName: String? = null,
)

@Serializable data class CharacterTemplate(val id: Long, val name: String)

fun JsonObject.text(key: String): String = (get(key) as? JsonPrimitive)?.contentOrNull.orEmpty()

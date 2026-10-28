package ru.dndshare.client.ui.character

import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

internal val journalTypes =
    linkedMapOf(
        "event" to "Событие",
        "quest" to "Задание",
        "dialog" to "Диалог",
        "battle" to "Бой",
        "newday" to "Новый день",
        "header" to "Заголовок",
    )

internal fun initialJournalInput(target: String, response: JsonObject): JsonObject {
    val journal = response["journal"].objectValue()
    require(journal.isNotEmpty()) { "Дневник ещё не загружен." }
    val parts = target.split(':')
    val kind = parts[0]
    val identity = parts.getOrElse(1) { "new" }
    val sections = journal["sections"].arrayValue().map { it.objectValue() }
    val section = sections.firstOrNull { it["id"].referenceId()?.toString() == identity }
    val entries = sections.flatMap { it["events"].arrayValue() }.map { it.objectValue() }
    val entry = entries.firstOrNull { it["id"].referenceId()?.toString() == identity }
    if (identity != "new" && kind != "journal-source")
        require((if (kind == "journal-section") section else entry) != null) {
            "Запись больше не существует."
        }
    val base =
        when (kind) {
            "journal-entry" -> entry
            "journal-section" -> section
            else -> null
        }.objectValue()
    return JsonObject(
        base +
            buildJsonObject {
                put("journalUuid", journal.text("uuid"))
                put("identity", identity)
                put(
                    "expectedGraphRevision",
                    journal["graph"].objectValue()["revision"] ?: JsonPrimitive(0),
                )
                base["changedAt"]?.let { put("expectedChangedAt", it) }
                if (kind == "journal-source") {
                    put("sourceUuid", identity)
                    put(
                        "sourceName",
                        response["sources"]
                            .arrayValue()
                            .map { it.objectValue() }
                            .firstOrNull { it.text("uuid") == identity }
                            ?.text("name")
                            .orEmpty(),
                    )
                }
                if (kind == "journal-entry" && entry == null) {
                    put("sectionId", parts.getOrElse(2) { "0" })
                    put("type", parts.getOrElse(3) { "event" })
                    put("title", "")
                    put("desc", "")
                    put(
                        "payload",
                        buildJsonObject {
                            if (parts.getOrNull(3) == "quest")
                                put(
                                    "quest",
                                    buildJsonObject {
                                        put("reward", "")
                                        put("objectives", JsonArray(emptyList()))
                                    },
                                )
                        },
                    )
                }
                if (kind == "journal-section" && section == null) {
                    put("title", "")
                    put("date", "")
                }
            }
    )
}

internal fun journalFormCommand(form: SheetFormFields, uuid: String): CharacterCommandSpec {
    val data = form.input
    val journal = data.text("journalUuid")
    require(journal.matches(Regex("[a-fA-F0-9-]{36}")))
    val kind = form.target.substringBefore(':')
    val identity = data.text("identity")
    val removing = data["remove"] == JsonPrimitive(true)
    val method = if (removing) "DELETE" else if (identity == "new") "POST" else "PATCH"
    var path = "journals/$journal"
    val body =
        when (kind) {
            "journal-source" -> {
                path = "char/$uuid/journal-source"
                buildJsonObject { put("journalUuid", data.text("sourceUuid")) }
            }
            "journal-section" -> {
                path += "/sections" + if (identity == "new") "" else "/${identity.toLong()}"
                buildJsonObject {
                    put("title", data.text("title").trim())
                    put("date", data.text("date"))
                    data["expectedChangedAt"]?.let { put("expectedChangedAt", it) }
                }
            }
            "journal-entry" -> {
                path +=
                    if (identity == "new") "/sections/${data.text("sectionId").toLong()}/entries"
                    else "/entries/${identity.toLong()}"
                require(data.text("type") in journalTypes)
                require(data.text("title").codePointCount(0, data.text("title").length) <= 255) {
                    "Название: до 255 символов."
                }
                require(data.text("desc").codePointCount(0, data.text("desc").length) <= 20000) {
                    "Описание: до 20 000 символов."
                }
                buildJsonObject {
                    for (key in
                        listOf(
                            "type",
                            "title",
                            "desc",
                            "payload",
                            "expectedChangedAt",
                            "expectedGraphRevision",
                        )) data[key]?.let { put(key, it) }
                }
            }
            else -> error("Неизвестное действие дневника.")
        }
    return CharacterCommandSpec(
        "journal",
        buildJsonObject {
            put("path", path)
            put("method", if (kind == "journal-source") "PUT" else method)
            put("body", body)
        },
        false,
    )
}

internal fun journalOrderCommand(target: String, response: JsonObject): CharacterCommandSpec {
    val parts = target.split(':')
    val journal = response["journal"].objectValue()
    val section =
        journal["sections"]
            .arrayValue()
            .map { it.objectValue() }
            .firstOrNull { it["id"].referenceId()?.toString() == parts.getOrNull(1) }
            ?: error("Раздел больше не существует.")
    val ids = section["events"].arrayValue().mapNotNull { it.referenceId() }
    val index = ids.indexOf(parts.getOrNull(2)?.toLongOrNull())
    require(index >= 0) { "Запись больше не существует." }
    val next = (index + if (parts.getOrNull(3) == "up") 1 else -1).coerceIn(0, ids.lastIndex)
    val ordered =
        ids.toMutableList().apply {
            val entry = removeAt(index)
            add(next, entry)
        }
    return CharacterCommandSpec(
        "journal",
        buildJsonObject {
            put(
                "path",
                "journals/${journal.text("uuid")}/sections/${section["id"].referenceId()}/entries/order",
            )
            put("method", "PUT")
            put(
                "body",
                buildJsonObject {
                    put("entryIds", JsonArray(ordered.map(::JsonPrimitive)))
                    put("expectedEntryIds", JsonArray(ids.map(::JsonPrimitive)))
                },
            )
        },
        false,
    )
}

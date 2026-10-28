package ru.dndshare.client.network

import io.ktor.client.call.*
import io.ktor.client.request.*
import io.ktor.http.*
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

/** Journal creates carry a stable receipt key; updates reconcile a lost acknowledgement. */
suspend fun ApiClient.journalCommand(characterUuid: String, command: JsonObject): JsonObject {
    val path = command.text("path")
    require(
        path.matches(
            Regex(
                "journals/[a-fA-F0-9-]+(?:/sections(?:/[0-9]+(?:/entries(?:/order)?)?)?|/entries/[0-9]+)?|char/[a-fA-F0-9-]+/journal-source"
            )
        )
    )
    val method = HttpMethod.parse(command.text("method"))
    require(method in listOf(HttpMethod.Post, HttpMethod.Patch, HttpMethod.Put, HttpMethod.Delete))
    val body =
        JsonObject(
            command["body"].objectValue() + ("clientActionId" to command.getValue("clientActionId"))
        )
    if (path.startsWith("journals/")) {
        val uuid = path.split('/')[1]
        val current =
            client
                .get("$baseUrl/api/journals/$uuid")
                .let { with(this) { it.checked() } }
                .body<JsonObject>()
        val journal = current["journal"].objectValue()
        if (method == HttpMethod.Put && journalOrderAlreadyApplied(journal, path, body))
            return current
        val id = path.substringAfterLast('/').toLongOrNull()
        if (path.contains("/entries/") && id != null) {
            val entry =
                journal["sections"]
                    .arrayValue()
                    .flatMap { it.objectValue()["events"].arrayValue() }
                    .map { it.objectValue() }
                    .firstOrNull { it["id"].referenceId() == id }
            if (method == HttpMethod.Delete && entry == null) return current
            if (
                method == HttpMethod.Patch &&
                    entry != null &&
                    listOf("type", "title", "desc", "payload").all { entry[it] == body[it] }
            )
                return current
        }
        if (path.contains("/sections/") && !path.contains("/entries") && id != null) {
            val section =
                journal["sections"]
                    .arrayValue()
                    .map { it.objectValue() }
                    .firstOrNull { it["id"].referenceId() == id }
            if (method == HttpMethod.Delete && section == null) return current
            if (
                method == HttpMethod.Patch &&
                    section != null &&
                    listOf("title", "date").all { section[it] == body[it] }
            )
                return current
        }
    }
    val response =
        client.request("$baseUrl/api/$path") {
            this.method = method
            contentType(ContentType.Application.Json)
            if (method != HttpMethod.Delete) setBody(body)
        }
    with(this) { response.checked() }
    return if (response.status == HttpStatusCode.NoContent) JsonObject(emptyMap())
    else response.body()
}

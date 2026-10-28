package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.model.Book
import ru.dndshare.client.model.text
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun ContentSourceFields(
    settings: JsonObject,
    books: List<Book>,
    enabled: Boolean = true,
    allowLegacyControl: Boolean = true,
    change: (JsonObject) -> Unit,
) {
    val selected = settings.text("mode") == "selected"
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("Все доступные книги", Modifier.weight(1f), style = ShareTypography.group)
        Switch(
            !selected,
            {
                change(
                    JsonObject(settings + ("mode" to JsonPrimitive(if (it) "all" else "selected")))
                )
            },
            enabled = enabled,
        )
    }
    if (selected) {
        val ids = settings["ids"].arrayValue().mapNotNull { it.referenceId() }
        books.forEach { book ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(
                    book.id in ids,
                    { checked ->
                        change(
                            JsonObject(
                                settings +
                                    ("ids" to
                                        JsonArray(
                                            (if (checked) ids + book.id else ids - book.id)
                                                .distinct()
                                                .map(::JsonPrimitive)
                                        ))
                            )
                        )
                    },
                    enabled = enabled,
                )
                Text(book.name, style = ShareTypography.group)
            }
        }
        Text(
            "Ваши записи и материалы без привязки к книге остаются доступны.",
            style = ShareTypography.context,
            color = WebPalette.TextSecondary,
        )
    }
    if (allowLegacyControl)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Устаревший и требующий адаптации контент",
                Modifier.weight(1f),
                style = ShareTypography.group,
            )
            Switch(
                settings["allowLegacy"] == JsonPrimitive(true),
                { change(JsonObject(settings + ("allowLegacy" to JsonPrimitive(it)))) },
                enabled = enabled,
            )
        }
}

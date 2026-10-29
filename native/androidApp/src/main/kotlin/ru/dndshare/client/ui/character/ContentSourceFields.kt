package ru.dndshare.client.ui.character

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
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
    ShareToggle("Все доступные книги", !selected, enabled = enabled) {
        change(JsonObject(settings + ("mode" to JsonPrimitive(if (it) "all" else "selected"))))
    }
    if (selected) {
        val ids = settings["ids"].arrayValue().mapNotNull { it.referenceId() }
        books.forEach { book ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                ShareCheckbox(
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
        ShareToggle(
            "Устаревший и требующий адаптации контент",
            settings["allowLegacy"] == JsonPrimitive(true),
            enabled = enabled,
        ) {
            change(JsonObject(settings + ("allowLegacy" to JsonPrimitive(it))))
        }
}

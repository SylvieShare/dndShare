package ru.dndshare.client.ui.character

import androidx.compose.material3.*
import androidx.compose.runtime.*
import com.fleeksoft.ksoup.Ksoup
import io.ktor.http.decodeURLQueryComponent
import java.net.URLEncoder
import kotlinx.serialization.json.*
import ru.dndshare.client.character.*
import ru.dndshare.client.data.CacheDao
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*
import ru.dndshare.client.ui.designsystem.richtext.ShareRichTextInput

internal val LocalRichCatalogue = staticCompositionLocalOf<CacheDao?> { null }

@Composable
internal fun CharacterRichInput(
    value: String,
    change: (String) -> Unit,
    label: String,
    enabled: Boolean,
) {
    ShareRichTextInput(
        value,
        change,
        label,
        enabled = enabled,
        insertActions = { insert ->
            for ((kind, title) in
                listOf(
                    "dice" to "Бросок",
                    "calculation" to "Расчёт",
                    "item" to "Предмет",
                    "suggest" to "Термин",
                    "stat" to "Показатель",
                )) {
                ShareTextButton(
                    onClick = {
                        insert(
                            "<span data-rich-node=\"$kind\" data-rich-payload=\"%7B%7D\"></span>",
                            title,
                            false,
                        )
                    },
                    enabled = enabled,
                ) {
                    Text(title)
                }
            }
        },
        embeddedEditor = { html, close, save -> RichNodeEditor(html, close, save) },
    )
}

@Composable
private fun RichNodeEditor(html: String, close: () -> Unit, save: (String?) -> Unit) {
    val element = remember(html) { Ksoup.parseBodyFragment(html).selectFirst("[data-rich-node]")!! }
    val kind = element.attr("data-rich-node")
    val payload =
        remember(html) {
            runCatching {
                    WireJson.parseToJsonElement(
                            element.attr("data-rich-payload").decodeURLQueryComponent()
                        )
                        .jsonObject
                }
                .getOrDefault(JsonObject(emptyMap()))
        }
    var label by remember(html) { mutableStateOf(payload.text("label").ifBlank { element.text() }) }
    var formula by remember(html) { mutableStateOf(payload.text("formula")) }
    var average by remember(html) { mutableStateOf(payload.text("average")) }
    var id by remember(html) { mutableStateOf(payload.text("id")) }
    var type by remember(html) { mutableStateOf(payload.text("typeId")) }
    var stat by remember(html) { mutableStateOf(payload.text("stat").ifBlank { "ac" }) }
    var choosing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val context = LocalCharacterSheet.current
    val cache = LocalRichCatalogue.current
    val inputs = remember { ShareFormInputs() }
    CompositionLocalProvider(LocalShareFormInputs provides inputs) {
        ShareFormDialog(
            when (kind) {
                "dice" -> "Формула броска"
                "calculation" -> "Расчёт в описании"
                "item" -> "Ссылка на предмет"
                "suggest" -> "Термин справочника"
                else -> "Игровой показатель"
            },
            close,
            actions = {
                ShareTextButton(onClick = { save(null) }) {
                    Text("Удалить", color = WebPalette.Danger)
                }
                ShareTextButton(close) { Text("Отмена") }
                ShareButton(
                    onClick = {
                        inputs.flush()
                        try {
                            val next = buildJsonObject {
                                when (kind) {
                                    "dice",
                                    "calculation" -> {
                                        if (kind == "dice") {
                                            require(rollDice(formula) { 1 }.dice.isNotEmpty()) {
                                                "В формуле должен быть кубик."
                                            }
                                            if (average.isNotBlank())
                                                put(
                                                    "average",
                                                    average
                                                        .replace(',', '.')
                                                        .toDoubleOrNull()
                                                        ?.takeIf { it.isFinite() }
                                                        ?: error("Проверьте среднее значение."),
                                                )
                                        } else richFormula(formula)
                                        put("formula", formula.trim())
                                        if (label.isNotBlank()) put("label", label.trim())
                                    }
                                    "item",
                                    "suggest" -> {
                                        put(
                                            "id",
                                            id.toLongOrNull()?.takeIf { it > 0 }
                                                ?: error("Выберите запись."),
                                        )
                                        if (kind == "suggest")
                                            put(
                                                "typeId",
                                                type.toLongOrNull()?.takeIf { it > 0 }
                                                    ?: error("Выберите раздел."),
                                            )
                                    }
                                    "stat" -> put("stat", stat)
                                }
                            }
                            element.attr(
                                "data-rich-payload",
                                URLEncoder.encode(next.toString(), "UTF-8"),
                            )
                            element.text(
                                label.ifBlank {
                                    if (kind == "stat") if (stat == "ac") "КД" else "хиты"
                                    else formula
                                }
                            )
                            save(element.outerHtml())
                        } catch (problem: Exception) {
                            error = problem.message
                        }
                    }
                ) {
                    Text("Сохранить")
                }
            },
        ) {
            when (kind) {
                "dice",
                "calculation" -> {
                    ShareTextInput(formula, { formula = it }, "Формула")
                    ShareTextInput(label, { label = it }, "Подпись")
                    if (kind == "dice")
                        ShareTextInput(
                            average,
                            { average = it },
                            "Среднее значение (необязательно)",
                        )
                    else
                        Text(
                            richFormulaVariables
                                .map { "${it.key}: ${it.value}" }
                                .joinToString("\n"),
                            style = ShareTypography.context,
                        )
                }
                "item" -> {
                    Text(label.ifBlank { "Выберите предмет" }, style = ShareTypography.group)
                    if (cache != null) ShareAction("Выбрать из справочника", { choosing = true })
                    else ShareTextInput(id, { id = it }, "Номер записи")
                }
                "suggest" -> {
                    ShareSelect(
                        "Раздел",
                        type,
                        context.metadata.suggests.keys
                            .sortedBy { it.toLongOrNull() }
                            .map {
                                it to
                                    (context.metadata.suggestTypes
                                        .firstOrNull { t -> t.id.toString() == it }
                                        ?.name ?: "Раздел $it")
                            },
                    ) {
                        type = it
                        id = ""
                    }
                    ShareSelect(
                        "Значение",
                        id,
                        context.metadata.suggests[type].orEmpty().map {
                            it.id.toString() to it.value
                        },
                    ) { selected ->
                        id = selected
                        label =
                            context.metadata.suggests[type]
                                ?.firstOrNull { it.id.toString() == selected }
                                ?.value
                                .orEmpty()
                    }
                }
                else ->
                    ShareSelect(
                        "Показатель",
                        stat,
                        listOf("ac" to "Класс доспеха", "hp" to "Хиты"),
                    ) {
                        stat = it
                    }
            }
            error?.let { Text(it, color = WebPalette.Danger) }
        }
    }
    if (choosing && cache != null)
        SheetItemPicker(
            cache,
            context.sheet,
            context.metadata.types.map { it.id },
            { choosing = false },
        ) { item ->
            id = item.id.toString()
            label = item.name
            choosing = false
        }
}

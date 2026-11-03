package ru.dndshare.client.ui.maps

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.key.*
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kotlinx.serialization.json.*
import ru.dndshare.client.maps.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun MapReferenceCoreFields(reference: MapReferenceController) {
    val current = reference.draft?.current ?: return
    for ((key, label) in
        listOf(
            "code" to "Код группы",
            "variantCode" to "Код вариантов",
            "name" to "Название (русский)",
            "nameEn" to "Название (английский)",
            "groupName" to "Группа (русский)",
            "groupNameEn" to "Группа (английский)",
        )) ShareTextInput(current.string(key), { reference.set(key, JsonPrimitive(it)) }, label)
    ShareSelect(
        "Проработка текстур",
        current.string("textureDetail", "basic"),
        listOf("basic" to "Поверхностная", "detailed" to "Детальная"),
    ) {
        reference.set("textureDetail", JsonPrimitive(it))
    }
    ShareTokenInput(
        current.array("tags").map { it.jsonPrimitive.content },
        { reference.set("tags", JsonArray(it.map(::JsonPrimitive))) },
        "Метки",
        allowCreate = true,
    )
    if (current.string("tileType") != "object") {
        ShareSelect("Категория", current.string("category"), mapTileCategories) {
            reference.set("category", JsonPrimitive(it))
        }
        ShareSelect(
            "Форма тайла",
            current.string("tileType"),
            listOf("floor" to "Пол") +
                mapWallTypes +
                mapTileCategories.filter {
                    it.first !in setOf("floor", "wall", "water", "railway")
                },
        ) {
            reference.set("tileType", JsonPrimitive(it))
        }
        ShareSelect(
            "Расположение стен",
            current.string("wallMode", "none"),
            listOf("none" to "Нет стен", "edge" to "По граням", "corner" to "По углам"),
        ) {
            reference.set("wallMode", JsonPrimitive(it))
        }
        if (current.string("wallMode", "none") != "none") {
            val directions =
                listOf(
                    "Север",
                    "Северо-восток",
                    "Восток",
                    "Юго-восток",
                    "Юг",
                    "Юго-запад",
                    "Запад",
                    "Северо-запад",
                )
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                repeat(8) { index ->
                    if (current.string("wallMode") == "corner" || index % 2 == 0)
                        ShareChoiceChip(
                            (current.number("wallMask").toInt() and (1 shl index)) != 0,
                            {
                                reference.set(
                                    "wallMask",
                                    JsonPrimitive(
                                        current.number("wallMask").toInt() xor (1 shl index)
                                    ),
                                )
                            },
                            { Text(directions[index].take(2)) },
                            Modifier.weight(1f),
                        )
                }
            }
        }
    }
    ShareToggle("Есть предметы или декорации", current.flag("hasDecor")) {
        reference.set("hasDecor", JsonPrimitive(it))
    }
    ShareToggle("Можно встать", current.flag("canStand")) {
        reference.set("canStand", JsonPrimitive(it))
    }
}

@Composable
internal fun MapReferenceGeometry(reference: MapReferenceController) {
    val current = reference.draft?.current ?: return
    MapInspectorSection("Геометрия модели") {
        for ((key, label) in
            listOf(
                "mountDepth" to "Глубина монтажного основания",
                "surfaceHeight" to "Высота поверхности",
                "maxHeight" to "Полная высота модели",
            )) ReferenceNumber(current.number(key), label) {
            reference.activeField = key
            reference.number(key, it)
        }
        val offset = current.array("placementOffset")
        for ((index, label) in
            listOf(0 to "Смещение модели X", 1 to "Смещение модели Z")) ReferenceNumber(
            offset.double(index),
            label,
        ) { value ->
            value
                .replace(',', '.')
                .toDoubleOrNull()
                ?.takeIf { it.isFinite() }
                ?.let { number ->
                    val values = current.array("placementOffset").toMutableList()
                    while (values.size < 2) values += JsonPrimitive(0)
                    values[index] = JsonPrimitive(number)
                    reference.set("placementOffset", JsonArray(values))
                    reference.activeField = if (index == 0) "offsetX" else "offsetZ"
                }
        }
        if (current.number("mountDepth") > 0)
            ShareTextInput(
                current.string("mountProfile"),
                { reference.set("mountProfile", JsonPrimitive(it)) },
                "Профиль выступа",
            )
        if ("referenceDiameter" in current)
            ReferenceNumber(current.number("referenceDiameter"), "Диаметр опоры модели") {
                reference.number("referenceDiameter", it)
            }
    }
    MapInspectorSection("Занимаемые клетки") {
        val width = current.number("width", 1.0).toInt()
        val height = current.number("height", 1.0).toInt()
        fun choose(x: Int, y: Int) {
            reference.set("width", JsonPrimitive(x.coerceIn(1, 8)))
            reference.set("height", JsonPrimitive(y.coerceIn(1, 8)))
        }
        Canvas(
            Modifier.size(208.dp)
                .focusable()
                .onKeyEvent { event ->
                    if (event.type != KeyEventType.KeyDown) false
                    else
                        when (event.key) {
                            Key.DirectionRight -> {
                                choose(width + 1, height)
                                true
                            }
                            Key.DirectionLeft -> {
                                choose(width - 1, height)
                                true
                            }
                            Key.DirectionUp -> {
                                choose(width, height - 1)
                                true
                            }
                            Key.DirectionDown -> {
                                choose(width, height + 1)
                                true
                            }
                            else -> false
                        }
                }
                .pointerInput(width, height) {
                    detectTapGestures { point ->
                        choose(
                            (point.x / size.width * 8).toInt() + 1,
                            (point.y / size.height * 8).toInt() + 1,
                        )
                    }
                }
        ) {
            val cell = size.width / 8
            for (y in 0..7) for (x in 0..7) drawRoundRect(
                if (x < width && y < height) WebPalette.Accent else WebPalette.Raised,
                Offset(x * cell, y * cell),
                Size(cell - 3.dp.toPx(), cell - 3.dp.toPx()),
                CornerRadius(3.dp.toPx()),
            )
        }
        ReferenceNumber(width.toDouble(), "Ширина тайла в клетках") {
            reference.number("width", it)
        }
        ReferenceNumber(height.toDouble(), "Длина тайла в клетках") {
            reference.number("height", it)
        }
        Text(
            "${width*height} клеток · выберите прямоугольник на сетке.",
            style = ShareTypography.context,
            color = WebPalette.TextMuted,
        )
    }
}

@Composable
internal fun ReferenceNumber(value: Double, label: String, change: (String) -> Unit) {
    ShareTextInput(
        if (value == value.toLong().toDouble()) value.toLong().toString() else value.toString(),
        change,
        label,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
    )
}

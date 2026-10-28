package ru.dndshare.client.ui.character

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import java.text.NumberFormat
import java.util.Locale
import kotlinx.serialization.json.*
import ru.dndshare.client.BuildConfig
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.ui.designsystem.*

@Composable
internal fun InventoryWallet() {
    val context = LocalCharacterSheet.current
    val money = context.sheet.values["money"].objectValue()
    val amounts = money["amounts"].objectValue()
    val rows =
        walletCurrencyIds(money, context.metadata)
            .filter {
                (amounts[it] as? JsonPrimitive)?.longOrNull?.let { value -> value > 0 } == true
            }
            .reversed()
    val format = NumberFormat.getIntegerInstance(Locale.forLanguageTag("ru-RU"))
    ShareTile(
        Modifier.fillMaxWidth().semantics {
            contentDescription = if (context.canEdit) "Изменить кошелёк" else "Кошелёк"
        },
        framed = false,
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
        onClick = if (context.canEdit) ({ context.edit("money") }) else null,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            AppGlyph(Glyph.Wallet, Modifier.size(22.dp), WebPalette.TextMuted)
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (rows.isEmpty())
                    Text("Денег нет", style = ShareTypography.context, color = WebPalette.TextMuted)
                rows.forEachIndexed { index, id ->
                    val coin =
                        context.metadata.suggests["17"].orEmpty().firstOrNull {
                            it.id.toString() == id
                        }
                    val amount = (amounts[id] as? JsonPrimitive)?.longOrNull ?: 0
                    val color =
                        coin?.color?.let {
                            runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull()
                        } ?: WebPalette.TextMuted
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier =
                            Modifier.semantics(mergeDescendants = true) {
                                contentDescription =
                                    "${format.format(amount)} ${coin?.value ?: "Монеты"}"
                            },
                    ) {
                        Text(
                            format.format(amount),
                            style =
                                ShareTypography.group.copy(
                                    fontSize = 20.sp,
                                    lineHeight = 20.sp,
                                    fontWeight = FontWeight.Bold,
                                ),
                        )
                        val svg = coin?.svg?.takeIf(String::isNotBlank)
                        val source: Any? =
                            coin?.iconImageUrl
                                ?: svg?.let {
                                    if (it.trimStart().startsWith("<svg"))
                                        it.replace(
                                                "currentColor",
                                                "#%06x".format(color.toArgb() and 0xffffff),
                                            )
                                            .toByteArray()
                                    else if (it.startsWith('/'))
                                        BuildConfig.API_BASE_URL.trimEnd('/') + it
                                    else it
                                }
                        if (source != null)
                            AsyncImage(
                                source,
                                null,
                                imageLoader = context.images,
                                modifier = Modifier.size(24.dp),
                            )
                        else Box(Modifier.size(12.dp).background(color, CircleShape))
                        if (index < rows.lastIndex)
                            Text(
                                ",",
                                style = ShareTypography.group.copy(fontSize = 20.sp),
                                color = WebPalette.TextSecondary,
                            )
                    }
                }
            }
        }
    }
}

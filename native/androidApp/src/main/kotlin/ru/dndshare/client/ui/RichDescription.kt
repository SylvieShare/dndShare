package ru.dndshare.client.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.ClickableText
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.*
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import coil3.compose.AsyncImage
import com.fleeksoft.ksoup.Ksoup
import com.fleeksoft.ksoup.nodes.*
import io.ktor.http.decodeURLQueryComponent
import kotlinx.serialization.json.*
import ru.dndshare.client.BuildConfig
import ru.dndshare.client.model.WireJson
import ru.dndshare.client.ui.designsystem.*
import ru.dndshare.client.ui.designsystem.richtext.RichTableModel

fun richDescription(html: String, linkColor: Color): AnnotatedString = buildAnnotatedString {
    val blocks =
        setOf(
            "p",
            "div",
            "section",
            "article",
            "blockquote",
            "h1",
            "h2",
            "h3",
            "h4",
            "ul",
            "ol",
            "table",
            "pre",
        )
    fun newline() {
        if (length > 0 && toAnnotatedString().text.lastOrNull() != '\n') append('\n')
    }
    fun walk(node: Node) {
        if (node is TextNode) {
            append(node.text())
            return
        }
        if (node !is Element) return
        val tag = node.tagName().lowercase()
        if (tag in setOf("script", "style", "iframe", "video", "audio", "svg")) return
        if (tag == "br") {
            append('\n')
            return
        }
        if (tag == "img") {
            append(node.attr("alt"))
            return
        }
        if (tag in blocks || tag in setOf("li", "tr")) newline()
        if (tag == "li") {
            val list = node.parent()
            if (list?.tagName() == "ol")
                append(
                    "${list.children().indexOf(node) + (list.attr("start").toIntOrNull() ?: 1)}. "
                )
            else append("• ")
        }
        if (tag in setOf("td", "th") && length > 0 && toAnnotatedString().text.lastOrNull() != '\n')
            append("   │   ")
        val payload =
            if (node.hasAttr("data-rich-node"))
                runCatching {
                    WireJson.parseToJsonElement(
                            node.attr("data-rich-payload").decodeURLQueryComponent()
                        )
                        .jsonObject
                }
                    .getOrNull()
            else null
        val kind = node.attr("data-rich-node")
        val id = if (kind == "item") payload?.get("id")?.jsonPrimitive?.longOrNull else null
        val formula =
            if (kind in setOf("dice", "calculation"))
                payload?.get("formula")?.jsonPrimitive?.content
            else null
        val suggest = if (kind == "suggest" && payload != null) payload.toString() else null
        val href =
            node.attr("href").takeIf {
                tag == "a" &&
                    (it.startsWith("https://") ||
                        it.startsWith("http://") ||
                        it.startsWith("mailto:"))
            }
        val style =
            SpanStyle(
                fontWeight =
                    if (tag in setOf("b", "strong", "th", "h1", "h2", "h3", "h4")) FontWeight.Bold
                    else null,
                fontStyle = if (tag in setOf("i", "em")) FontStyle.Italic else null,
                fontSize =
                    when (tag) {
                        "h1" -> 1.8.em
                        "h2" -> 1.5.em
                        "h3",
                        "h4" -> 1.25.em
                        else -> androidx.compose.ui.unit.TextUnit.Unspecified
                    },
                fontFamily = if (tag in setOf("pre", "code")) FontFamily.Monospace else null,
                color =
                    if (id != null || href != null || formula != null || suggest != null) linkColor
                    else Color.Unspecified,
                textDecoration =
                    when {
                        tag in setOf("s", "del", "strike") -> TextDecoration.LineThrough
                        id != null || href != null || formula != null || tag == "u" ->
                            TextDecoration.Underline
                        else -> null
                    },
            )
        val annotation =
            when {
                id != null -> "item" to id.toString()
                href != null -> "URL" to href
                formula != null -> kind to formula
                suggest != null -> "suggest" to suggest
                else -> null
            }
        annotation?.let { pushStringAnnotation(it.first, it.second) }
        pushStyle(style)
        node.childNodes().forEach(::walk)
        pop()
        if (annotation != null) pop()
        if (tag in blocks || tag in setOf("li", "tr")) newline()
    }
    Ksoup.parseBodyFragment(html).body().childNodes().forEach(::walk)
}

internal data class RichBlock(
    val html: String = "",
    val table: String? = null,
    val image: String? = null,
    val alt: String = "",
)

internal fun descriptionBlocks(html: String): List<RichBlock> = buildList {
    val pending = StringBuilder()
    fun flush() {
        if (pending.isNotBlank()) add(RichBlock(pending.toString()))
        pending.clear()
    }
    fun visit(node: Node) {
        if (node is Element && node.tagName() == "table") {
            flush()
            add(RichBlock(table = node.outerHtml()))
        } else if (node is Element && node.tagName() == "img") {
            flush()
            add(RichBlock(image = node.attr("src"), alt = node.attr("alt")))
        } else if (
            node is Element &&
                (node.selectFirst("table,img") != null ||
                    node.tagName() in setOf("div", "section", "article"))
        ) {
            flush()
            node.childNodes().forEach(::visit)
            flush()
        } else if (
            node is Element &&
                node.tagName() in
                    setOf("p", "h1", "h2", "h3", "h4", "ul", "ol", "blockquote", "pre")
        ) {
            flush()
            add(RichBlock(node.outerHtml()))
        } else pending.append(node.outerHtml())
    }
    Ksoup.parseBodyFragment(html).body().childNodes().forEach(::visit)
    flush()
}

@Suppress("DEPRECATION")
@Composable
fun RichDescription(html: String, modifier: Modifier = Modifier, openItem: (Long) -> Unit) {
    val color = MaterialTheme.colorScheme.primary
    val uri = LocalUriHandler.current
    val interactions = LocalRichInteractions.current
    var image by remember(html) { mutableStateOf<Pair<String, String>?>(null) }
    var calculation by remember { mutableStateOf<Pair<String, String>?>(null) }
    val follow: (AnnotatedString.Range<String>) -> Unit = { link ->
        when (link.tag) {
            "item" -> link.item.toLongOrNull()?.let(openItem)
            "URL" -> runCatching { uri.openUri(link.item) }
            "dice" ->
                if (interactions.roll != null)
                    interactions.roll.invoke("Бросок из описания", link.item)
                else
                    calculation =
                        "Бросок" to
                            runCatching {
                                ru.dndshare.client.character.rollDice(link.item).let {
                                    "${it.formula} = ${it.total}"
                                }
                            }
                                .getOrElse { it.message.orEmpty() }
            "calculation" ->
                calculation =
                    "Расчёт" to
                        runCatching {
                            "${link.item} = ${ru.dndshare.client.character.richFormula(link.item, interactions.variables).value ?: "Нужен контекст персонажа"}"
                        }
                            .getOrElse { it.message.orEmpty() }
            "suggest" -> {
                val payload = WireJson.parseToJsonElement(link.item).jsonObject
                val entry =
                    interactions.metadata.suggests[payload["typeId"]?.jsonPrimitive?.content]
                        ?.firstOrNull { it.id == payload["id"]?.jsonPrimitive?.longOrNull }
                calculation =
                    (entry?.value ?: "Термин справочника") to
                        (entry
                            ?.desc
                            ?.let { Ksoup.parseBodyFragment(it).text() }
                            ?.takeIf { it.isNotBlank() } ?: "Описание не добавлено")
            }
        }
    }
    val blocks = remember(html) { descriptionBlocks(html) }
    SelectionContainer {
        Column(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            blocks.forEach { block ->
                when {
                    block.image != null -> {
                        val url =
                            if (block.image.startsWith('/'))
                                BuildConfig.API_BASE_URL.trimEnd('/') + block.image
                            else block.image
                        if (interactions.images != null)
                            AsyncImage(
                                url,
                                block.alt,
                                imageLoader = interactions.images,
                                modifier =
                                    Modifier.fillMaxWidth().heightIn(max = 480.dp).clickable(
                                        onClickLabel = "Открыть изображение",
                                        role = Role.Button,
                                    ) {
                                        image = url to block.alt
                                    },
                            )
                        else
                            AsyncImage(
                                url,
                                block.alt,
                                modifier =
                                    Modifier.fillMaxWidth().heightIn(max = 480.dp).clickable(
                                        onClickLabel = "Открыть изображение",
                                        role = Role.Button,
                                    ) {
                                        image = url to block.alt
                                    },
                            )
                    }
                    block.table != null -> {
                        val table =
                            remember(block.table) {
                                runCatching { RichTableModel(block.table) }.getOrNull()
                            }
                        if (table != null)
                            ShareSpanTable(
                                table.cells.map { cell ->
                                    ShareTableCell(
                                        cell.row,
                                        cell.column,
                                        cell.rows,
                                        cell.columns,
                                        cell.html,
                                        cell.header,
                                    )
                                },
                                table.columns,
                            ) { cell ->
                                RichDescription(cell, openItem = openItem)
                            }
                    }
                    else -> {
                        val text =
                            remember(block.html, color) { richDescription(block.html, color) }
                        ClickableText(
                            text,
                            style =
                                ShareTypography.body.copy(
                                    color = MaterialTheme.colorScheme.onSurface
                                ),
                        ) { offset ->
                            text.getStringAnnotations(offset, offset).firstOrNull()?.let(follow)
                        }
                    }
                }
            }
        }
    }
    image?.let { (url, title) -> RichImageViewer(url, title, interactions.images) { image = null } }
    calculation?.let { (title, result) ->
        ShareFormDialog(title, { calculation = null }) { androidx.compose.material3.Text(result) }
    }
}

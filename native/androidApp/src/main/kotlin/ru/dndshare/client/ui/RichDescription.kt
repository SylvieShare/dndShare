package ru.dndshare.client.ui

import ru.dndshare.client.ui.designsystem.*
import androidx.compose.foundation.layout.*
import androidx.compose.ui.unit.dp

import androidx.compose.foundation.text.ClickableText
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import com.fleeksoft.ksoup.Ksoup
import com.fleeksoft.ksoup.nodes.Element
import com.fleeksoft.ksoup.nodes.Node
import com.fleeksoft.ksoup.nodes.TextNode
import io.ktor.http.decodeURLQueryComponent
import kotlinx.serialization.json.*
import ru.dndshare.client.model.WireJson

fun richDescription(html: String, linkColor: Color): AnnotatedString = buildAnnotatedString {
    val blocks = setOf("p", "div", "section", "article", "blockquote", "h1", "h2", "h3", "h4", "ul", "ol", "table")
    fun newline() { if (length > 0 && toAnnotatedString().text.lastOrNull() != '\n') append('\n') }
    fun walk(node: Node) {
        if (node is TextNode) { append(node.text()); return }
        if (node !is Element) return
        val tag = node.tagName().lowercase()
        if (tag in setOf("script", "style", "iframe", "video", "audio", "svg")) return
        if (tag == "br") { append('\n'); return }
        if (tag == "img") { append(node.attr("alt")); return }
        if (tag in blocks || tag in setOf("li", "tr")) newline()
        if (tag == "li") append("• ")
        if (tag in setOf("td", "th") && length > 0 && toAnnotatedString().text.lastOrNull() != '\n') append("   │   ")
        val id = if (node.attr("data-rich-node") == "item") runCatching {
            WireJson.parseToJsonElement(node.attr("data-rich-payload").decodeURLQueryComponent())
                .jsonObject["id"]?.jsonPrimitive?.longOrNull
        }.getOrNull() else null
        val href = node.attr("href").takeIf { tag == "a" && (it.startsWith("https://") || it.startsWith("http://")) }
        val style = SpanStyle(
            fontWeight = if (tag in setOf("b", "strong", "th", "h1", "h2", "h3", "h4")) FontWeight.Bold else null,
            fontStyle = if (tag in setOf("i", "em")) FontStyle.Italic else null,
            color = if (id != null || href != null) linkColor else Color.Unspecified,
            textDecoration = if (id != null || href != null || tag == "u") TextDecoration.Underline else null,
        )
        if (id != null) pushStringAnnotation("item", id.toString())
        else if (href != null) pushStringAnnotation("URL", href)
        pushStyle(style)
        node.childNodes().forEach(::walk)
        pop()
        if (id != null || href != null) pop()
        if (tag in blocks || tag in setOf("li", "tr")) newline()
    }
    Ksoup.parseBodyFragment(html).body().childNodes().forEach(::walk)
}

internal data class RichBlock(val html: String = "", val rows: List<List<String>>? = null, val header: Boolean = false)

internal fun descriptionBlocks(html: String): List<RichBlock> = buildList {
    val pending = StringBuilder()
    fun flush() {
        if (pending.isNotBlank()) add(RichBlock(pending.toString()))
        pending.clear()
    }
    fun visit(node: Node) {
        if (node is Element && node.tagName() == "table") {
            flush()
            add(RichBlock(rows = node.select("tr").map { row -> row.children().filter { it.tagName() in setOf("th", "td") }.map { it.html() } },
                header = node.selectFirst("tr th") != null))
        } else if (node is Element && (node.selectFirst("table") != null || node.tagName() in setOf("div", "section", "article"))) {
            flush(); node.childNodes().forEach(::visit); flush()
        } else if (node is Element && node.tagName() in setOf("p", "h1", "h2", "h3", "h4", "ul", "ol", "blockquote")) {
            flush(); add(RichBlock(node.outerHtml()))
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
    val follow: (AnnotatedString.Range<String>) -> Unit = { link ->
        if (link.tag == "item") link.item.toLongOrNull()?.let(openItem)
        else if (link.tag == "URL") runCatching { uri.openUri(link.item) }
    }
    val blocks = remember(html) { descriptionBlocks(html) }
    SelectionContainer {
        Column(modifier, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            blocks.forEach { block ->
                val rows = block.rows
                if (rows != null) {
                    val text = remember(rows, color) { rows.map { row -> row.map { richDescription(it, color) } } }
                    ShareTable(text, block.header, follow)
                } else {
                    val text = remember(block.html, color) { richDescription(block.html, color) }
                    ClickableText(text, style = ShareTypography.body.copy(color = MaterialTheme.colorScheme.onSurface)) { offset ->
                        text.getStringAnnotations(offset, offset).firstOrNull()?.let(follow)
                    }
                }
            }
        }
    }
}

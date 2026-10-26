package ru.dndshare.client.ui

import androidx.compose.foundation.text.ClickableText
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
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
        val style = SpanStyle(
            fontWeight = if (tag in setOf("b", "strong", "th", "h1", "h2", "h3", "h4")) FontWeight.Bold else null,
            fontStyle = if (tag in setOf("i", "em")) FontStyle.Italic else null,
            color = if (id != null) linkColor else Color.Unspecified,
            textDecoration = if (id != null || tag == "u") TextDecoration.Underline else null,
        )
        if (id != null) pushStringAnnotation("item", id.toString())
        pushStyle(style)
        node.childNodes().forEach(::walk)
        pop()
        if (id != null) pop()
        if (tag in blocks || tag in setOf("li", "tr")) newline()
    }
    Ksoup.parseBodyFragment(html).body().childNodes().forEach(::walk)
}

@Suppress("DEPRECATION")
@Composable
fun RichDescription(html: String, modifier: Modifier = Modifier, openItem: (Long) -> Unit) {
    val color = MaterialTheme.colorScheme.primary
    val text = remember(html, color) { richDescription(html, color) }
    SelectionContainer {
        ClickableText(text, modifier, style = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface)) { offset ->
            text.getStringAnnotations("item", offset, offset).firstOrNull()?.item?.toLongOrNull()?.let(openItem)
        }
    }
}

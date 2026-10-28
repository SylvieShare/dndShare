package ru.dndshare.client.ui.designsystem.richtext

import com.fleeksoft.ksoup.Ksoup
import com.fleeksoft.ksoup.nodes.Element
import java.util.UUID

internal class RichListEntry(val element: Element, val key: String = UUID.randomUUID().toString()) {
    var html: String
        get() = element.html()
        set(value) {
            element.html(value)
        }
}

/**
 * Keep list/item attributes and nested rich content; changing one row never flattens its siblings.
 */
internal class RichListModel(html: String) {
    private val root =
        Ksoup.parseBodyFragment(html).body().children().single().also {
            require(it.tagName() in setOf("ol", "ul"))
        }
    val entries =
        root.children().filter { it.tagName() == "li" }.map(::RichListEntry).toMutableList()

    fun add(): RichListEntry = RichListEntry(Element("li")).also { entries.add(it) }

    fun remove(key: String) {
        entries.removeAll { it.key == key }
    }

    fun move(key: String, delta: Int) {
        val index = entries.indexOfFirst { it.key == key }
        require(index >= 0)
        val next = (index + delta).coerceIn(0, entries.lastIndex)
        entries.add(next, entries.removeAt(index))
    }

    fun html(): String {
        val result = root.clone()
        result.children().filter { it.tagName() == "li" }.forEach { it.remove() }
        entries.forEach { result.appendChild(it.element.clone()) }
        return result.outerHtml()
    }
}

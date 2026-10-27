package ru.dndshare.client.ui.character

fun statColumnOrder(heights: List<Int>, columns: Int, gap: Int = 12): List<Int> {
    if (columns <= 1 || heights.size < 2) return heights.indices.toList()
    val count = minOf(columns, heights.size, 3)
    val groups = List(count) { mutableListOf<Int>() }
    var best = emptyList<Int>()
    var spread = Int.MAX_VALUE
    fun visit(index: Int, used: Int) {
        if (index == heights.size) {
            if (groups.any { it.isEmpty() }) return
            val sums = groups.map { group -> group.sumOf(heights::get) + gap * (group.size - 1) }
            val range = sums.max() - sums.min()
            if (range < spread) { spread = range; best = groups.flatten() }
            return
        }
        for (column in 0 until minOf(count, used + 1)) {
            groups[column] += index
            visit(index + 1, maxOf(used, column + 1))
            groups[column].removeAt(groups[column].lastIndex)
        }
    }
    visit(0, 0)
    return best
}

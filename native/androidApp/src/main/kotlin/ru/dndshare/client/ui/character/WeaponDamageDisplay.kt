package ru.dndshare.client.ui.character

import ru.dndshare.client.character.WeaponDamagePart

internal data class WeaponDamageGroup(
    val type: String,
    val color: String,
    val terms: List<List<List<WeaponDamagePart>>>,
    val modifier: Int,
)

/** Same grouping as web DamageDice: shared grip terms and the flat bonus appear only once. */
internal fun weaponDamageGroups(
    parts: List<WeaponDamagePart>,
    alternative: List<WeaponDamagePart>,
    bonus: Int,
): List<WeaponDamageGroup> {
    val keys = (parts + alternative).map { it.type to it.color }.distinct()
    if (keys.isEmpty()) return listOf(WeaponDamageGroup("", "", emptyList(), bonus))
    return keys.mapIndexed { index, key ->
        val one = parts.filter { it.type == key.first && it.color == key.second }
        val remaining =
            alternative.filter { it.type == key.first && it.color == key.second }.toMutableList()
        val terms =
            if (alternative.isEmpty()) listOf(listOf(one))
            else {
                val common = mutableListOf<WeaponDamagePart>()
                val single = mutableListOf<WeaponDamagePart>()
                one.forEach { part ->
                    val found = remaining.indexOfFirst {
                        it.count == part.count && it.sides == part.sides
                    }
                    if (found < 0) single += part else common += remaining.removeAt(found)
                }
                buildList {
                    if (single.isNotEmpty() || remaining.isNotEmpty())
                        add(listOf(single, remaining.toList()))
                    if (common.isNotEmpty()) add(listOf(common))
                }
            }
        WeaponDamageGroup(key.first, key.second, terms, if (index == 0) bonus else 0)
    }
}

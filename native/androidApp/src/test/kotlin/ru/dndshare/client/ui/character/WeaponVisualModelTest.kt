package ru.dndshare.client.ui.character

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class WeaponVisualModelTest {
    @Test
    fun versatileDamageSharesTheAdditionalDiceAndBonusOnlyOnce() {
        val base = WeaponDamagePart(1, 8, "Рубящий", color = "#ffc000")
        val versatile = base.copy(sides = 10)
        val shared = base.copy(sides = 6)
        val fire = WeaponDamagePart(2, 6, "Огонь", color = "#ff5500")
        val groups =
            weaponDamageGroups(listOf(base, shared, fire), listOf(versatile, shared, fire), 3)
        assertEquals(2, groups.size)
        assertEquals(
            listOf(listOf(listOf(base), listOf(versatile)), listOf(listOf(shared))),
            groups[0].terms,
        )
        assertEquals(listOf(listOf(listOf(fire))), groups[1].terms)
        assertEquals(listOf(3, 0), groups.map { it.modifier })
    }

    @Test
    fun reorderingPreservesInstanceStateAndConcurrentNewItems() {
        fun entry(id: String, value: Int) = buildJsonObject {
            put("uid", id)
            put("params", buildJsonObject { put("remaining", value) })
        }
        val a = entry("a", 2)
        val b = entry("b", 5)
        val extra = entry("new", 7)
        assertEquals(
            listOf(b, a, extra),
            orderedWeapons(listOf(a, b, extra), listOf("b", "a", "removed")),
        )
        assertFails { orderedWeapons(listOf(a, b), listOf("a", "a")) }
    }

    @Test
    fun resourceColorsMatchWebOwnersAndConfiguredOverrides() {
        val item = CatalogueItem(214, 19, "Посох молнии")
        val resource =
            ResourceControl(
                "abilities:magic_items:staff",
                "Заряды",
                3,
                3,
                JsonObject(emptyMap()),
                emptyList(),
                1,
                ResourceOwner(214, "magic_items", "staff"),
            )
        assertEquals("#fb7185", resourceDisplayColor(resource, mapOf(214L to item)))
        assertEquals(
            "#123abc",
            resourceDisplayColor(
                resource.copy(
                    rule =
                        buildJsonObject {
                            put("resource_color", "#123abc")
                        }
                ),
                mapOf(214L to item),
            ),
        )
        assertEquals(
            "#fbbf24",
            resourceDisplayColor(resource.copy(key = "classes:pool", owner = null), emptyMap()),
        )
    }

    @Test
    fun svgVisualsSurviveCatalogueSerializationIncludingExplicitAbsence() {
        val svg = "<svg viewBox=\"0 0 24 24\"></svg>"
        val item = CatalogueItem(1, 1, "Оружие", svg = svg)
        val payload = WireJson.encodeToJsonElement(CatalogueItem.serializer(), item).jsonObject
        assertEquals(svg, payload.text("svg"))
        assertTrue(
            WireJson.encodeToJsonElement(CatalogueItem.serializer(), item.copy(svg = null))
                .jsonObject
                .containsKey("svg")
        )
    }
}

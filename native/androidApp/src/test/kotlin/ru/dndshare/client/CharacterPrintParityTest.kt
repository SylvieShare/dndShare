package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.*
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*
import ru.dndshare.client.print.*

class CharacterPrintParityTest {
    private fun obj(text: String) = WireJson.parseToJsonElement(text).jsonObject

    private val sheet =
        CharacterSheet(
            "DND5",
            1,
            obj(
                """{"values":{"name":"Лира","lvl":{"level":4,"exp":3000},"STR":{"value":{"base":14}},"INT":{"value":{"base":18},"skills":{"custom":{"override_title":"Знание грибов","up":1,"bonuses":[{"value":3}]}}},"WIS":{"value":{"base":12}},"CHA":{"value":{"base":10}},"weapon":[{"uid":"staff","item_id":1,"proficient":true}],"hp":{"current":18,"max":{"base":20}},"money":{"order":[1],"amounts":{"1":4000000000}},"spells":{"schema_version":2,"slot_pools":{},"tabs":[{"key":"wizard","name":"Маг","casting_ability":4,"mode":"known","spells":[{"key":"a","id":2}]},{"key":"cleric","name":"Жрец","casting_ability":5,"mode":"prepared","spells":[{"key":"b","id":2,"prepared":true}]}],"grants":[{"key":"gift","id":2,"casting_ability":6,"slotless":true,"source":{"label":"Покровитель"}}]}}}"""
            ),
            1,
        )
    private val items =
        mapOf(
            1L to
                CatalogueItem(
                    1,
                    1,
                    "Посох",
                    data = obj("""{"attacks":[{"count":1,"dice_id":"d6","type":1}]}"""),
                ),
            2L to
                CatalogueItem(2, 5, "Свет", data = obj("""{"lvl":1,"desc":"<p>Описание.</p>"}""")),
        )

    @Test
    fun printUsesComputedWeaponAndCustomSkillNumbersAndKeepsLargeBalances() {
        val content = characterPrintContent(sheet, items, HandbookMetadata())
        val staff = content.blocks.single { it.title == "Посох" }
        assertEquals("+4", staff.values.toMap()["Атака"])
        assertEquals("1d6+2", staff.values.toMap()["Урон"])
        assertEquals(
            "+9",
            content.blocks.single { it.title == "Навыки" }.values.toMap()["Знание грибов"],
        )
        assertEquals(
            "4000000000",
            content.blocks.single { it.title == "Кошелёк" }.values.single().second,
        )
    }

    @Test
    fun theSameSpellKeepsEachSourcesCastingNumbersAndGrantLabel() {
        val spells =
            characterPrintContent(sheet, items, HandbookMetadata()).blocks.filter {
                it.title == "Свет"
            }
        assertEquals(3, spells.size)
        assertEquals(
            listOf("+6", "+3", "+2"),
            spells.map { it.values.toMap()["Атака заклинанием"] },
        )
        assertEquals(
            listOf("14", "11", "10"),
            spells.map { it.values.toMap()["Сложность спасброска"] },
        )
        assertEquals("Покровитель", spells.last().values.toMap()["Источник"])
        assertEquals("Не требуется", spells.last().values.toMap()["Ячейка"])
    }

    @Test
    fun vtmPrintIncludesAllHealthTracksAndAvailableExperience() {
        val vtm =
            CharacterSheet(
                "VTM20",
                1,
                obj(
                    """{"values":{"char_name":"Алекс","health":["bashing","lethal","aggravated","","","",""],"xp_total":15,"xp_spent":7}}"""
                ),
                1,
            )
        val content = characterPrintContent(vtm, emptyMap(), HandbookMetadata())
        assertEquals(7, content.blocks.single { it.title == "Здоровье" }.values.size)
        assertEquals("8", content.blocks.single { it.title == "Опыт" }.values.toMap()["Доступно"])
    }
}

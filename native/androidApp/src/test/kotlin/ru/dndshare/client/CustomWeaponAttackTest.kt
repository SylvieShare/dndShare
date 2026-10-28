package ru.dndshare.client

import kotlin.test.*
import kotlinx.serialization.json.jsonObject
import org.junit.Test
import ru.dndshare.client.character.*
import ru.dndshare.client.model.*

class CustomWeaponAttackTest {
    @Test
    fun aCustomWeaponUsesItsOwnedUidWithoutInventingACatalogueReference() {
        val sheet =
            CharacterSheet(
                "DND5",
                1,
                WireJson.parseToJsonElement(
                        """{"values":{"lvl":{"level":4},"STR":{"value":{"base":14}},"weapon":[{"uid":"custom","item_id":null,"override":{"name":"Авторский удар"},"proficient":true,"stat_suggest_id":1,"add_attacks":[{"count":1,"dice_id":"d4","type_suggest_id":1}]}]}}"""
                    )
                    .jsonObject,
                1,
            )
        val request =
            weaponAttackRequest(
                sheet,
                "custom",
                WeaponRollOptions(),
                emptyMap(),
                HandbookMetadata(),
            )
        assertEquals("custom", request.targetUid)
        assertEquals(4, request.bonus)
        assertNull(request.sourceItemId)
        assertTrue(request.weaponAttack)
    }
}

package store

import _ "embed"

//go:embed schema/102_weapon_uses.sql
var schemaWeaponUsesSQL string

//go:embed schema/101_item_last_charge.sql
var schemaItemLastChargeSQL string

//go:embed schema/100_weapon_damage_units.sql
var schemaWeaponDamageUnitsSQL string

//go:embed schema/99_magic_weapon_refresh.sql
var schemaMagicWeaponRefreshSQL string

//go:embed schema/103_weapon_bonus_transfer.sql
var schemaWeaponBonusTransferSQL string

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

//go:embed schema/105_selected_target.sql
var schemaSelectedTargetSQL string

//go:embed schema/106_initial_item_charges.sql
var schemaInitialItemChargesSQL string

//go:embed schema/107_luck_blade_rules.sql
var schemaLuckBladeRulesSQL string

//go:embed schema/95_weapon_charges_effects.sql
var schemaWeaponChargesEffectsSQL string

//go:embed schema/94_magic_equipment_mechanics.sql
var schemaMagicEquipmentMechanicsSQL string

//go:embed schema/93_trident_fish_command.sql
var schemaTridentFishCommandSQL string

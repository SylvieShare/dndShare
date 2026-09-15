package store

import _ "embed"

//go:embed schema/92_weapon_instances.sql
var schemaWeaponInstancesSQL string

//go:embed schema/91_throw_label.sql
var schemaThrowLabelSQL string

//go:embed schema/90_conditional_weapon_damage.sql
var schemaConditionalWeaponDamageSQL string

//go:embed schema/126_spell_concentration.sql
var schemaSpellConcentrationSQL string

//go:embed schema/127_session_auto_accept.sql
var schemaSessionAutoAcceptSQL string

package store

import _ "embed"

//go:embed schema/167_session_karmic_dice.sql
var schemaSessionKarmicDiceSQL string

//go:embed schema/168_fractional_karmic_dice.sql
var schemaFractionalKarmicDiceSQL string

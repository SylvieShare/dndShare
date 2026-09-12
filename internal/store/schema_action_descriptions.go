package store

import _ "embed"

//go:embed schema/98_action_description_conditions.sql
var schemaActionDescriptionConditionsSQL string

//go:embed schema/97_dawn_recovery_theses.sql
var schemaDawnRecoveryThesesSQL string

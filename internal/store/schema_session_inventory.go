package store

import _ "embed"

//go:embed schema/125_session_inventory.sql
var schemaSessionInventorySQL string

//go:embed schema/155_inventory_grid.sql
var schemaInventoryGridSQL string

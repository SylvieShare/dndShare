package store

import _ "embed"

//go:embed schema/160_item_purchase_quantity.sql
var schemaItemPurchaseQuantitySQL string

//go:embed schema/161_inventory_counter_migration.sql
var schemaInventoryCounterMigrationSQL string

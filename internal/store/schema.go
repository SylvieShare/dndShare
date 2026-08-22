package store

import (
	"context"
	_ "embed"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

// The schema is split by domain, but remains one atomic startup migration.
// The explicit order is part of the database contract: later sections may
// reference objects and seed data created by earlier ones.

//go:embed schema/01_foundation.sql
var schemaFoundationSQL string

//go:embed schema/02_handbook.sql
var schemaHandbookSQL string

//go:embed schema/03_characters.sql
var schemaCharactersSQL string

//go:embed schema/04_sessions.sql
var schemaSessionsSQL string

//go:embed schema/05_seed.sql
var schemaSeedSQL string

//go:embed schema/06_item_icons.sql
var schemaItemIconsSQL string

//go:embed schema/07_feature_icons.sql
var schemaFeatureIconsSQL string

//go:embed schema/08_session_world.sql
var schemaSessionWorldSQL string

//go:embed schema/09_session_images.sql
var schemaSessionImagesSQL string

//go:embed schema/10_session_presentation.sql
var schemaSessionPresentationSQL string

//go:embed schema/11_session_material_types.sql
var schemaSessionMaterialTypesSQL string

//go:embed schema/12_user_storage.sql
var schemaUserStorageSQL string

//go:embed schema/13_material_links.sql
var schemaMaterialLinksSQL string

//go:embed schema/14_session_entities.sql
var schemaSessionEntitiesSQL string

//go:embed schema/15_rich_content.sql
var schemaRichContentSQL string

//go:embed schema/16_handbook_filters.sql
var schemaHandbookFiltersSQL string

//go:embed schema/16_session_timers.sql
var schemaSessionTimersSQL string

//go:embed schema/17_race_images.sql
var schemaRaceImagesSQL string

//go:embed schema/18_race_lore.sql
var schemaRaceLoreSQL string

//go:embed schema/19_subrace_images.sql
var schemaSubraceImagesSQL string

//go:embed schema/20_class_images.sql
var schemaClassImagesSQL string

//go:embed schema/21_class_lore.sql
var schemaClassLoreSQL string

//go:embed schema/22_system_item_media.sql
var schemaSystemItemMediaSQL string

//go:embed schema/23_starting_shop.sql
var schemaStartingShopSQL string

//go:embed schema/24_armor_catalog.sql
var schemaArmorCatalogSQL string

//go:embed schema/24_handbook_type_icons.sql
var schemaHandbookTypeIconsSQL string

//go:embed schema/25_weapon_catalog.sql
var schemaWeaponCatalogSQL string

//go:embed schema/26_transport_catalog.sql
var schemaTransportCatalogSQL string

//go:embed schema/27_background_equipment.sql
var schemaBackgroundEquipmentSQL string

//go:embed schema/28_item_instance_params.sql
var schemaItemInstanceParamsSQL string

//go:embed schema/29_item_catalog_fixes.sql
var schemaItemCatalogFixesSQL string

//go:embed schema/30_item_type_hierarchy.sql
var schemaItemTypeHierarchySQL string

//go:embed schema/31_tool_proficiency_catalog.sql
var schemaToolProficiencyCatalogSQL string

//go:embed schema/32_ability_resources.sql
var schemaAbilityResourcesSQL string

//go:embed schema/33_class_tool_choices.sql
var schemaClassToolChoicesSQL string

//go:embed schema/34_ability_resource_catalog_fixes.sql
var schemaAbilityResourceCatalogFixesSQL string

//go:embed schema/35_ability_resource_catalog_audit.sql
var schemaAbilityResourceCatalogAuditSQL string

//go:embed schema/36_ability_resource_colors.sql
var schemaAbilityResourceColorsSQL string

//go:embed schema/37_ability_spell_grants.sql
var schemaAbilitySpellGrantsSQL string

//go:embed schema/38_equipped_armor.sql
var schemaEquippedArmorSQL string

//go:embed schema/39_character_defenses_and_racial_grants.sql
var schemaCharacterDefensesAndRacialGrantsSQL string

//go:embed schema/40_ability_spell_cast_level.sql
var schemaAbilitySpellCastLevelSQL string

//go:embed schema/41_ability_choices.sql
var schemaAbilityChoicesSQL string

//go:embed schema/42_racial_automation.sql
var schemaRacialAutomationSQL string

//go:embed schema/43_class_ability_automation.sql
var schemaClassAbilityAutomationSQL string

var schemaParts = []struct {
	name string
	sql  string
}{
	{"foundation", schemaFoundationSQL},
	{"handbook", schemaHandbookSQL},
	{"characters", schemaCharactersSQL},
	{"sessions", schemaSessionsSQL},
	{"seed", schemaSeedSQL},
	{"item-icons", schemaItemIconsSQL},
	{"feature-icons", schemaFeatureIconsSQL},
	{"session-world", schemaSessionWorldSQL},
	{"session-images", schemaSessionImagesSQL},
	{"session-presentation", schemaSessionPresentationSQL},
	{"session-material-types", schemaSessionMaterialTypesSQL},
	{"user-storage", schemaUserStorageSQL},
	{"material-links", schemaMaterialLinksSQL},
	{"session-entities", schemaSessionEntitiesSQL},
	{"rich-content", schemaRichContentSQL},
	{"handbook-filters", schemaHandbookFiltersSQL},
	{"session-timers", schemaSessionTimersSQL},
	{"race-images", schemaRaceImagesSQL},
	{"race-lore", schemaRaceLoreSQL},
	{"subrace-images", schemaSubraceImagesSQL},
	{"class-images", schemaClassImagesSQL},
	{"class-lore", schemaClassLoreSQL},
	{"system-item-media", schemaSystemItemMediaSQL},
	{"starting-shop", schemaStartingShopSQL},
	{"armor-catalog", schemaArmorCatalogSQL},
	{"handbook-type-icons", schemaHandbookTypeIconsSQL},
	{"weapon-catalog", schemaWeaponCatalogSQL},
	{"transport-catalog", schemaTransportCatalogSQL},
	{"background-equipment", schemaBackgroundEquipmentSQL},
	{"item-instance-params", schemaItemInstanceParamsSQL},
	{"item-catalog-fixes", schemaItemCatalogFixesSQL},
	{"item-type-hierarchy", schemaItemTypeHierarchySQL},
	{"tool-proficiency-catalog", schemaToolProficiencyCatalogSQL},
	{"ability-resources", schemaAbilityResourcesSQL},
	{"class-tool-choices", schemaClassToolChoicesSQL},
	{"ability-resource-catalog-fixes", schemaAbilityResourceCatalogFixesSQL},
	{"ability-resource-catalog-audit", schemaAbilityResourceCatalogAuditSQL},
	{"ability-resource-colors", schemaAbilityResourceColorsSQL},
	{"ability-spell-grants", schemaAbilitySpellGrantsSQL},
	{"equipped-armor", schemaEquippedArmorSQL},
	{"character-defenses-and-racial-grants", schemaCharacterDefensesAndRacialGrantsSQL},
	{"ability-spell-cast-level", schemaAbilitySpellCastLevelSQL},
	{"ability-choices", schemaAbilityChoicesSQL},
	{"racial-automation", schemaRacialAutomationSQL},
	{"class-ability-automation", schemaClassAbilityAutomationSQL},
}

func applySchema(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin schema transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for _, part := range schemaParts {
		if _, err := tx.Exec(ctx, part.sql); err != nil {
			return fmt.Errorf("apply schema part %s: %w", part.name, err)
		}
	}
	richStats, err := migrateLegacyRichContent(ctx, tx)
	if err != nil {
		return fmt.Errorf("migrate legacy rich content: %w", err)
	}
	if richStats.Items > 0 {
		log.Printf(
			"migrated legacy rich content: items=%d dice=%d averages=%d item_links=%d suggest_links=%d native_links=%d",
			richStats.Items,
			richStats.DiceNodes,
			richStats.DiceAverages,
			richStats.ItemNodes,
			richStats.SuggestNodes,
			richStats.NativeLinks,
		)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit schema: %w", err)
	}
	return nil
}

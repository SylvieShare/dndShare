package store

import (
	"context"
	"crypto/sha256"
	_ "embed"
	"errors"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5"
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

//go:embed schema/44_feat_automation.sql
var schemaFeatAutomationSQL string

//go:embed schema/45_rogue_automation.sql
var schemaRogueAutomationSQL string

//go:embed schema/46_rogue_catalog_fixes.sql
var schemaRogueCatalogFixesSQL string

//go:embed schema/47_weapon_damage_actions.sql
var schemaWeaponDamageActionsSQL string

//go:embed schema/48_feature_sheet_widgets.sql
var schemaFeatureSheetWidgetsSQL string

//go:embed schema/49_roll_adjustments.sql
var schemaRollAdjustmentsSQL string

//go:embed schema/50_feature_actions.sql
var schemaFeatureActionsSQL string

//go:embed schema/51_status_effects.sql
var schemaStatusEffectsSQL string

//go:embed schema/52_status_effect_levels.sql
var schemaStatusEffectLevelsSQL string

//go:embed schema/53_activity_restrictions.sql
var schemaActivityRestrictionsSQL string

//go:embed schema/54_status_effect_catalog.sql
var schemaStatusEffectCatalogSQL string

//go:embed schema/55_remove_status_suggest.sql
var schemaRemoveStatusSuggestSQL string

//go:embed schema/56_frenzy_action.sql
var schemaFrenzyActionSQL string

//go:embed schema/57_class_action_automation.sql
var schemaClassActionAutomationSQL string

//go:embed schema/58_half_caster_spellcasting.sql
var schemaHalfCasterSpellcastingSQL string

//go:embed schema/59_session_security.sql
var schemaSessionSecuritySQL string

//go:embed schema/60_shared_channel_divinity.sql
var schemaSharedChannelDivinitySQL string

//go:embed schema/61_spellbook_tabs.sql
var schemaSpellbookTabsSQL string

//go:embed schema/62_sacred_weapon_effect.sql
var schemaSacredWeaponEffectSQL string

//go:embed schema/63_spellbook_grant_cleanup.sql
var schemaSpellbookGrantCleanupSQL string

//go:embed schema/64_session_npc_bestiary.sql
var schemaSessionNPCBestiarySQL string

//go:embed schema/65_session_scene_location.sql
var schemaSessionSceneLocationSQL string

//go:embed schema/66_session_scene_visual_source.sql
var schemaSessionSceneVisualSourceSQL string

//go:embed schema/67_session_event_actor_item.sql
var schemaSessionEventActorItemSQL string

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
	{"feat-automation", schemaFeatAutomationSQL},
	{"rogue-automation", schemaRogueAutomationSQL},
	{"rogue-catalog-fixes", schemaRogueCatalogFixesSQL},
	{"weapon-damage-actions", schemaWeaponDamageActionsSQL},
	{"feature-sheet-widgets", schemaFeatureSheetWidgetsSQL},
	{"roll-adjustments", schemaRollAdjustmentsSQL},
	{"feature-actions", schemaFeatureActionsSQL},
	{"status-effects", schemaStatusEffectsSQL},
	{"status-effect-levels", schemaStatusEffectLevelsSQL},
	{"activity-restrictions", schemaActivityRestrictionsSQL},
	{"status-effect-catalog", schemaStatusEffectCatalogSQL},
	{"remove-status-suggest", schemaRemoveStatusSuggestSQL},
	{"frenzy-action", schemaFrenzyActionSQL},
	{"class-action-automation", schemaClassActionAutomationSQL},
	{"half-caster-spellcasting", schemaHalfCasterSpellcastingSQL},
	{"session-security", schemaSessionSecuritySQL},
	{"shared-channel-divinity", schemaSharedChannelDivinitySQL},
	{"spellbook-tabs", schemaSpellbookTabsSQL},
	{"sacred-weapon-effect", schemaSacredWeaponEffectSQL},
	{"spellbook-grant-cleanup", schemaSpellbookGrantCleanupSQL},
	{"session-npc-bestiary", schemaSessionNPCBestiarySQL},
	{"session-scene-location", schemaSessionSceneLocationSQL},
	{"session-scene-visual-source", schemaSessionSceneVisualSourceSQL},
	{"session-event-actor-item", schemaSessionEventActorItemSQL},
}

const (
	// A stable project-specific key serializes schema changes across concurrent starts.
	schemaMigrationLockID = int64(0x444e445348415245)
	// Databases created before versioned migrations already ran every part through 57
	// on each application start. Bootstrap only those markers; part 58 remains pending.
	legacySchemaBootstrapLast = "class-action-automation"
)

func schemaChecksum(sql string) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(sql)))
}

func schemaPartApplied(ctx context.Context, tx pgx.Tx, part struct {
	name string
	sql  string
}) (bool, error) {
	var checksum string
	err := tx.QueryRow(ctx,
		`SELECT checksum FROM dndshare.schema_migration WHERE code = $1`,
		part.name,
	).Scan(&checksum)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	want := schemaChecksum(part.sql)
	if checksum != want {
		return false, fmt.Errorf("schema migration %s changed after it was applied", part.name)
	}
	return true, nil
}

func bootstrapLegacySchemaMigrations(ctx context.Context, tx pgx.Tx) error {
	for _, part := range schemaParts {
		if _, err := tx.Exec(ctx,
			`INSERT INTO dndshare.schema_migration (code, checksum) VALUES ($1, $2)`,
			part.name, schemaChecksum(part.sql),
		); err != nil {
			return fmt.Errorf("record legacy schema migration %s: %w", part.name, err)
		}
		if part.name == legacySchemaBootstrapLast {
			return nil
		}
	}
	return fmt.Errorf("legacy schema bootstrap boundary %q is missing", legacySchemaBootstrapLast)
}

func applySchema(ctx context.Context, pool *pgxpool.Pool) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin schema transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, schemaMigrationLockID); err != nil {
		return fmt.Errorf("lock schema migrations: %w", err)
	}
	var legacyDatabase bool
	if err := tx.QueryRow(ctx, `SELECT to_regclass('dndshare.users') IS NOT NULL`).Scan(&legacyDatabase); err != nil {
		return fmt.Errorf("detect legacy schema: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		CREATE SCHEMA IF NOT EXISTS dndshare;
		CREATE TABLE IF NOT EXISTS dndshare.schema_migration (
			code text PRIMARY KEY,
			checksum text NOT NULL,
			applied_at timestamptz DEFAULT now() NOT NULL
		)`); err != nil {
		return fmt.Errorf("create schema migration ledger: %w", err)
	}
	var appliedCount int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM dndshare.schema_migration`).Scan(&appliedCount); err != nil {
		return fmt.Errorf("count schema migrations: %w", err)
	}
	if legacyDatabase && appliedCount == 0 {
		if err := bootstrapLegacySchemaMigrations(ctx, tx); err != nil {
			return err
		}
	}

	for _, part := range schemaParts {
		applied, err := schemaPartApplied(ctx, tx, part)
		if err != nil {
			return fmt.Errorf("check schema part %s: %w", part.name, err)
		}
		if applied {
			continue
		}
		if part.name == "remove-status-suggest" {
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
			statusRichStats, err := migrateStatusSuggestRichContent(ctx, tx)
			if err != nil {
				return fmt.Errorf("migrate status suggest rich content: %w", err)
			}
			if statusRichStats.Items > 0 {
				log.Printf(
					"migrated status rich references: items=%d nodes=%d",
					statusRichStats.Items,
					statusRichStats.Nodes,
				)
			}
		}
		if _, err := tx.Exec(ctx, part.sql); err != nil {
			return fmt.Errorf("apply schema part %s: %w", part.name, err)
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO dndshare.schema_migration (code, checksum) VALUES ($1, $2)`,
			part.name, schemaChecksum(part.sql),
		); err != nil {
			return fmt.Errorf("record schema part %s: %w", part.name, err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit schema: %w", err)
	}
	return nil
}

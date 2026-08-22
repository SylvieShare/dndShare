package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestToolProficiencyCatalogIsEmbeddedAfterItemTypeHierarchy(t *testing.T) {
	if len(schemaParts) < 11 {
		t.Fatal("schemaParts must contain the final item catalogue sections")
	}
	hierarchy := schemaParts[len(schemaParts)-11]
	tools := schemaParts[len(schemaParts)-10]
	resources := schemaParts[len(schemaParts)-9]
	classTools := schemaParts[len(schemaParts)-8]
	resourceFixes := schemaParts[len(schemaParts)-7]
	resourceAudit := schemaParts[len(schemaParts)-6]
	resourceColors := schemaParts[len(schemaParts)-5]
	spellGrants := schemaParts[len(schemaParts)-4]
	equippedArmor := schemaParts[len(schemaParts)-3]
	defenses := schemaParts[len(schemaParts)-2]
	castLevel := schemaParts[len(schemaParts)-1]
	if hierarchy.name != "item-type-hierarchy" || hierarchy.sql == "" || hierarchy.sql != schemaItemTypeHierarchySQL {
		t.Fatal("item-type-hierarchy schema must be embedded after the equipment catalogues")
	}
	if tools.name != "tool-proficiency-catalog" || tools.sql == "" || tools.sql != schemaToolProficiencyCatalogSQL {
		t.Fatal("tool proficiency catalogue must be embedded after the tool item type exists")
	}
	if resources.name != "ability-resources" || resources.sql == "" || resources.sql != schemaAbilityResourcesSQL {
		t.Fatal("ability resource fields must be embedded after handbook item types exist")
	}
	if classTools.name != "class-tool-choices" || classTools.sql == "" || classTools.sql != schemaClassToolChoicesSQL {
		t.Fatal("class tool choices must be embedded after concrete tool proficiencies exist")
	}
	if resourceFixes.name != "ability-resource-catalog-fixes" || resourceFixes.sql == "" || resourceFixes.sql != schemaAbilityResourceCatalogFixesSQL {
		t.Fatal("ability resource catalogue fixes must be embedded after resource fields exist")
	}
	if resourceAudit.name != "ability-resource-catalog-audit" || resourceAudit.sql == "" || resourceAudit.sql != schemaAbilityResourceCatalogAuditSQL {
		t.Fatal("ability resource catalogue audit must be embedded after targeted fixes")
	}
	if resourceColors.name != "ability-resource-colors" || resourceColors.sql == "" || resourceColors.sql != schemaAbilityResourceColorsSQL {
		t.Fatal("ability resource colors must be embedded after the complete resource catalogue")
	}
	if spellGrants.name != "ability-spell-grants" || spellGrants.sql == "" || spellGrants.sql != schemaAbilitySpellGrantsSQL {
		t.Fatal("ability spell grants must be embedded after the ability catalogue")
	}
	if equippedArmor.name != "equipped-armor" || equippedArmor.sql == "" || equippedArmor.sql != schemaEquippedArmorSQL {
		t.Fatal("equipped armor schema must be embedded after the item and ability catalogues")
	}
	if defenses.name != "character-defenses-and-racial-grants" || defenses.sql == "" || defenses.sql != schemaCharacterDefensesAndRacialGrantsSQL {
		t.Fatal("character defenses and racial grants must be embedded after the ability catalogue")
	}
	if castLevel.name != "ability-spell-cast-level" || castLevel.sql == "" || castLevel.sql != schemaAbilitySpellCastLevelSQL {
		t.Fatal("ability spell cast level must be embedded after the granted-spell contract")
	}
}

func TestCanonicalModifierBasedAbilitiesHaveStructuredResourceRules(t *testing.T) {
	for _, fragment := range []string{
		"Вдохновение барда",
		"Bardic Inspiration",
		"Гнев бури",
		"Wrath of the Storm",
		"'max_use_stat', resource_rules.stat_id",
		"'max_use_min', 1",
		"- 'manual_size' - 'max_use'",
		"entry.value - 'count' - 'max_use'",
	} {
		if !strings.Contains(schemaAbilityResourceCatalogFixesSQL, fragment) {
			t.Fatalf("ability resource catalogue fixes must contain %q", fragment)
		}
	}
}

func TestBardChoosesThreeConcreteMusicalToolProficiencies(t *testing.T) {
	for _, fragment := range []string{
		`"key":"tool_prof_choice"`,
		"class.data - 'tool_prof'",
		"'count', 3",
		"suggest.code LIKE 'tool-music-%'",
		"lower('Бард')",
		"jsonb_array_length(COALESCE(musical.ids, '[]'::jsonb)) = 10",
	} {
		if !strings.Contains(schemaClassToolChoicesSQL, fragment) {
			t.Fatalf("bard tool choice schema must contain %q", fragment)
		}
	}
}

func TestClassResourceSchemaExposesToolProficiencyChoice(t *testing.T) {
	path := filepath.Join("..", "..", "resources", "items", "item_9_shema.json")
	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	var fields []map[string]any
	if err := json.Unmarshal(contents, &fields); err != nil {
		t.Fatalf("parse %s: %v", path, err)
	}
	for _, field := range fields {
		if field["key"] != "tool_prof_choice" {
			continue
		}
		children, _ := field["fields"].([]any)
		if field["type"] != "object" || len(children) != 2 {
			t.Fatalf("unexpected class tool choice field: %#v", field)
		}
		return
	}
	t.Fatal("item_9 schema must expose tool_prof_choice")
}

func TestAbilityResourceSchemasExposeModifierFormula(t *testing.T) {
	for _, typeID := range []string{"3", "4", "7"} {
		path := filepath.Join("..", "..", "resources", "items", "item_"+typeID+"_shema.json")
		contents, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read ability schema %s: %v", typeID, err)
		}
		var fields []map[string]any
		if err := json.Unmarshal(contents, &fields); err != nil {
			t.Fatalf("parse ability schema %s: %v", typeID, err)
		}
		byKey := make(map[string]map[string]any, len(fields))
		for _, field := range fields {
			byKey[field["key"].(string)] = field
		}
		if byKey["max_use_stat"]["suggest_id"] != float64(16) {
			t.Fatalf("ability schema %s must select max_use_stat from suggest 16", typeID)
		}
		if byKey["max_use_min"]["default"] != float64(1) {
			t.Fatalf("ability schema %s must default max_use_min to 1", typeID)
		}
		for _, key := range []string{
			"resource_color",
			"max_use_stat_multiplier", "max_use_bonus", "max_use_level_multiplier",
			"max_use_scaling", "rollback_short_rest_level", "short_rest_recovery",
			"short_rest_recovery_level", "use_resources", "granted_spells",
		} {
			if byKey[key] == nil {
				t.Fatalf("ability schema %s must expose %s", typeID, key)
			}
		}
	}
	for _, fragment := range []string{"max_use_stat", "max_use_min", "item_type.id IN (3, 4, 7)"} {
		if !strings.Contains(schemaAbilityResourcesSQL, fragment) {
			t.Fatalf("ability resource startup schema must contain %q", fragment)
		}
	}
}

func TestAbilitySpellGrantsCoverFixedCatalogSources(t *testing.T) {
	for _, fragment := range []string{
		"granted_spells", "Природная иллюзия", "Заклинательная характеристика",
		"(4087,", "(1443,", "(4092,", "(4430,", "(4307,", "(4213,", "(4452,",
		"(4422,", "(4221,", "(4260,", "(4313,", "(4249,", "(4438,", "(4440,", "(4446,",
		`"slotless":true`, "item_type.id IN (3, 4, 7)",
	} {
		if !strings.Contains(schemaAbilitySpellGrantsSQL, fragment) {
			t.Fatalf("ability spell grants must contain %q", fragment)
		}
	}
}

func TestAbilityResourceColorsCoverCatalogAndNestedResources(t *testing.T) {
	for _, fragment := range []string{
		"Оружие дыхания", "Вдохновение барда", "Источник магии: очки чародейства",
		"Ярость", "Удачливый", "resource_color", "faerie_fire", "arcanum_9",
		"greater_restoration", "item_type.id IN (3, 4, 7)",
	} {
		if !strings.Contains(schemaAbilityResourceColorsSQL, fragment) {
			t.Fatalf("ability resource colors must contain %q", fragment)
		}
	}
}

func TestAbilityResourceAuditCoversRacesClassesAndFeats(t *testing.T) {
	for _, fragment := range []string{
		"Дроуская магия", "Дьявольское наследие",
		"max_use_level_multiplier", "max_use_scaling", "use_resources",
		"Подписные заклинания", "Таинственный арканум", "Химическое мастерство",
		"Удачливый", "Посвящённый в магию", "Мастер боевых искусств",
		"resource_version", "abilities_race", "abilities_class", "abilities_feats",
	} {
		if !strings.Contains(schemaAbilityResourceCatalogAuditSQL, fragment) {
			t.Fatalf("ability resource catalogue audit must contain %q", fragment)
		}
	}
}

func TestItemTypeHierarchyCreatesToolsAndKeepsOwnedEntriesInInventory(t *testing.T) {
	for _, fragment := range []string{
		"parent_type_id",
		"14,\n    'Инструменты'",
		"WHERE id IN (1, 10, 12, 13, 14)",
		"item.data ->> 'equipment_category' = 'tool'",
		"move_tools_collection_to_inventory",
		"values_data - 'tools'",
		"first_items || tools",
		"values.proficiencies",
	} {
		if !strings.Contains(schemaItemTypeHierarchySQL, fragment) {
			t.Fatalf("item type hierarchy schema must contain %q", fragment)
		}
	}
}

func TestBackgroundEquipmentUsesCanonicalItemReferences(t *testing.T) {
	for _, fragment := range []string{
		"CREATE TEMP TABLE background_grant_links",
		"('Моряк', 'tool', 1, 2, 'Инструменты навигатора', 1)",
		"('Моряк', 'equipment', 1, 1, 'Дубинка', 1)",
		"'tool_items'",
		"'equipment_items'",
		"'starting_coins'",
		"background.data - 'equipment'",
	} {
		if !strings.Contains(schemaBackgroundEquipmentSQL, fragment) {
			t.Fatalf("background equipment schema must contain %q", fragment)
		}
	}
}

func TestBackgroundEquipmentDefinesConcreteHandbookChoices(t *testing.T) {
	for _, fragment := range []string{
		"CREATE TEMP TABLE background_choice_option_sets",
		"CREATE TEMP TABLE background_choice_definitions",
		"('Преступник', 1, 'gaming_set'",
		"('Артист', 1, 'musical_instrument'",
		"('Народный герой', 1, 'artisan_tools'",
		"('Солдат', 2, 'gaming_gear'",
		"('Шарлатан', 1, 'charlatan_con'",
		"'replace_tool_prof_id'",
		"'replace_tool_item_id'",
		"'replace_equipment_item_id'",
		"'{item_choices}'",
	} {
		if !strings.Contains(schemaBackgroundEquipmentSQL, fragment) {
			t.Fatalf("background equipment schema must contain %q", fragment)
		}
	}
}

func TestTransportCatalogUsesStructuredMechanics(t *testing.T) {
	for _, fragment := range []string{
		`"key":"movement"`,
		`"key":"capacity"`,
		`"key":"creature_item_id"`,
		`"key":"vehicle_stats"`,
		"('Warhorse', 'self', NULL, 'Warhorse'",
		"('Donkey or Mule', 'self', NULL, 'Mule'",
		"('Saddle, Military', NULL, 'military_saddle'",
		"('Warship', 'sail'",
		"data - 'speed' - 'carrying_capacity'",
	} {
		if !strings.Contains(schemaTransportCatalogSQL, fragment) {
			t.Fatalf("transport catalogue schema must contain %q", fragment)
		}
	}
}

func TestWeaponCatalogLinksAnyMatchingProficiency(t *testing.T) {
	for _, fragment := range []string{
		`"key":"required_weapon_proficiencies"`,
		`"match":"any"`,
		"THEN 'Воинское оружие'",
		"ELSE 'Простое оружие'",
		"WHEN 'длинный меч' THEN 'Длинные мечи'",
		"WHEN 'боевой топор' THEN 'Боевые топоры'",
		"lower(item.name) = 'безоружный удар' THEN NULL",
		"array_remove(ARRAY[broad.id, specific.id]",
	} {
		if !strings.Contains(schemaWeaponCatalogSQL, fragment) {
			t.Fatalf("weapon catalogue schema must contain %q", fragment)
		}
	}
}

func TestToolCatalogLinksConcreteAndBroadProficiencies(t *testing.T) {
	for _, fragment := range []string{
		"'{required_tool_proficiencies}'",
		"('tool-music-lute', 'Лютня'",
		"('tool-game-dice', 'Кости'",
		"('Alchemist''s Supplies', 'artisan', 'Инструменты алхимика', 'Инструменты ремесленников')",
		"('Lute', 'musical', 'Лютня', 'Музыкальные инструменты')",
		"array_remove(ARRAY[specific.id, broad.id]",
		"'background con tools choice'",
		"jsonb_build_object('equipment_category', 'gear')",
	} {
		if !strings.Contains(schemaToolProficiencyCatalogSQL, fragment) {
			t.Fatalf("tool proficiency catalogue must contain %q", fragment)
		}
	}
}

func TestArmorCatalogLinksRequiredProficiency(t *testing.T) {
	for _, fragment := range []string{
		`"key":"required_armor_proficiency"`,
		"('light', 'Лёгкие доспехи')",
		"('medium', 'Средние доспехи')",
		"('heavy', 'Тяжёлые доспехи')",
		"('shield', 'Щиты')",
		"suggest.type_id = 3",
		"'{required_armor_proficiency}'",
	} {
		if !strings.Contains(schemaArmorCatalogSQL, fragment) {
			t.Fatalf("armor catalogue schema must contain %q", fragment)
		}
	}
}

func TestStartingShopSeedsDedicatedArmorAndTransportCatalogues(t *testing.T) {
	for _, fragment := range []string{
		"12,\n    'Доспехи'",
		"13,\n    'Транспорт'",
		"CREATE TEMP TABLE starting_shop_armor",
		"('Стёганый доспех', 'Padded Armor'",
		"('Щит', 'Shield'",
		"CREATE TEMP TABLE starting_shop_transport",
		"('Боевой конь', 'Warhorse'",
		"('Шлюпка', 'Rowboat'",
		"CREATE TEMP TABLE starting_shop_tools",
		"('Воровские инструменты', 'Thieves'' Tools'",
		"('Набор травника', 'Herbalism Kit'",
		"(92::bigint, 207::bigint, 'Щит +1'",
		"COALESCE(item.data ->> 'rarity', '0') = '0'",
		"lower(item.name) = 'праща'",
		"'available_in_starting_shop', true",
		`"key":"contents"`,
		"('Набор путешественника', 8, 'Верёвка пеньковая', 1)",
		"jsonb_build_object('item_id', item_id, 'count', quantity, 'params', params)",
		"JOIN LATERAL (",
		"ORDER BY (COALESCE(candidate.data ->> 'available_in_starting_shop', 'false') = 'true') DESC",
	} {
		if !strings.Contains(schemaStartingShopSQL, fragment) {
			t.Fatalf("starting shop schema must contain %q", fragment)
		}
	}
}

func TestEquipmentPackResourceSchemaExposesItemReferences(t *testing.T) {
	path := filepath.Join("..", "..", "resources", "items", "item_2_shema.json")
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	var fields []map[string]any
	if err := json.Unmarshal(body, &fields); err != nil {
		t.Fatalf("parse %s: %v", path, err)
	}
	for _, field := range fields {
		if field["key"] != "contents" {
			continue
		}
		if field["type"] != "object_array" {
			t.Fatalf("unexpected contents field: %#v", field)
		}
		children, _ := field["fields"].([]any)
		if len(children) != 3 {
			t.Fatalf("contents must contain item, quantity and instance params fields: %#v", field)
		}
		return
	}
	t.Fatal("item_2 schema must expose pack contents")
}

func TestItemInstanceParamsSchemaDefinesRopeAndWeaponParameters(t *testing.T) {
	for _, fragment := range []string{
		`"key":"magic_bonus"`,
		`"key":"length_ft"`,
		`instance_fields`,
		`'unit_cost_copper'`,
		`normalize_owned_item_entry`,
		`normalize_weapon_instances`,
		`entry -> 'id'`,
		`entry -> 'magic_up'`,
		`data - 'cost' - 'weight'`,
	} {
		if !strings.Contains(schemaItemInstanceParamsSQL, fragment) {
			t.Fatalf("item instance params schema must contain %q", fragment)
		}
	}
}

func TestItemCatalogFixesRestoreCanonicalEquipment(t *testing.T) {
	for _, fragment := range []string{
		"WHERE id = 423",
		"name_en = 'Rope, hempen'",
		"WHERE id = 424",
		"dndshare.replace_catalog_item_reference(saved_character.data, 1428, 424)",
		"DELETE FROM dndshare.item duplicate",
		"SET name = 'Комплект для лазания'",
		"lower('Climber''s Kit')",
		"lower('Rope of Climbing')",
		"lower('Rope of Entanglement')",
		"upper(content.code) = 'DMG'",
	} {
		if !strings.Contains(schemaItemCatalogFixesSQL, fragment) {
			t.Fatalf("item catalogue fixes schema must contain %q", fragment)
		}
	}
}

func TestStartingShopResourceSchemasExposeSharedFlag(t *testing.T) {
	for _, typeID := range []string{"1", "2", "10", "12", "13", "14"} {
		path := filepath.Join("..", "..", "resources", "items", "item_"+typeID+"_shema.json")
		body, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		var fields []map[string]any
		if err := json.Unmarshal(body, &fields); err != nil {
			t.Fatalf("parse %s: %v", path, err)
		}
		found := false
		for _, field := range fields {
			if field["key"] == "available_in_starting_shop" {
				found = field["filter"] == true
			}
		}
		if !found {
			t.Fatalf("%s must expose available_in_starting_shop as a filter", path)
		}
	}
}

func TestArmorResourceSchemaExposesRequiredProficiencySuggest(t *testing.T) {
	path := filepath.Join("..", "..", "resources", "items", "item_12_shema.json")
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	var fields []map[string]any
	if err := json.Unmarshal(body, &fields); err != nil {
		t.Fatalf("parse %s: %v", path, err)
	}
	for _, field := range fields {
		if field["key"] != "required_armor_proficiency" {
			continue
		}
		if field["type"] != "suggest" || field["suggest_type_id"] != float64(3) || field["filter"] != true {
			t.Fatalf("unexpected required proficiency field: %#v", field)
		}
		return
	}
	t.Fatal("item_12 schema must expose required_armor_proficiency")
}

func TestWeaponResourceSchemaExposesAnyMatchingProficiencies(t *testing.T) {
	path := filepath.Join("..", "..", "resources", "items", "item_1_shema.json")
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	var fields []map[string]any
	if err := json.Unmarshal(body, &fields); err != nil {
		t.Fatalf("parse %s: %v", path, err)
	}
	for _, field := range fields {
		if field["key"] != "required_weapon_proficiencies" {
			continue
		}
		if field["type"] != "suggest_array" || field["suggest_id"] != float64(4) || field["match"] != "any" || field["filter"] != true {
			t.Fatalf("unexpected weapon proficiency field: %#v", field)
		}
		return
	}
	t.Fatal("item_1 schema must expose required_weapon_proficiencies")
}

func TestToolResourceSchemaExposesAnyMatchingProficiencies(t *testing.T) {
	path := filepath.Join("..", "..", "resources", "items", "item_14_shema.json")
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	var fields []map[string]any
	if err := json.Unmarshal(body, &fields); err != nil {
		t.Fatalf("parse %s: %v", path, err)
	}
	for _, field := range fields {
		if field["key"] != "required_tool_proficiencies" {
			continue
		}
		if field["type"] != "suggest_array" || field["suggest_id"] != float64(5) || field["match"] != "any" || field["filter"] != true {
			t.Fatalf("unexpected tool proficiency field: %#v", field)
		}
		return
	}
	t.Fatal("item_14 schema must expose required_tool_proficiencies")
}

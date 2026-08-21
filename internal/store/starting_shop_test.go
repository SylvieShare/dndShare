package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestToolProficiencyCatalogIsEmbeddedAfterItemTypeHierarchy(t *testing.T) {
	if len(schemaParts) < 2 {
		t.Fatal("schemaParts must contain the final item catalogue sections")
	}
	penultimate := schemaParts[len(schemaParts)-2]
	last := schemaParts[len(schemaParts)-1]
	if penultimate.name != "item-type-hierarchy" || penultimate.sql == "" || penultimate.sql != schemaItemTypeHierarchySQL {
		t.Fatal("item-type-hierarchy schema must be embedded after the equipment catalogues")
	}
	if last.name != "tool-proficiency-catalog" || last.sql == "" || last.sql != schemaToolProficiencyCatalogSQL {
		t.Fatal("tool proficiency catalogue must be embedded after the tool item type exists")
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

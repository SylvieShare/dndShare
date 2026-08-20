package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestTransportCatalogSchemaIsEmbeddedLast(t *testing.T) {
	if len(schemaParts) == 0 {
		t.Fatal("schemaParts is empty")
	}
	last := schemaParts[len(schemaParts)-1]
	if last.name != "transport-catalog" || last.sql == "" || last.sql != schemaTransportCatalogSQL {
		t.Fatal("transport-catalog schema must be embedded as the final startup migration")
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
		"('Набор путешественника', 8, 'Верёвка пеньковая (50 футов)', 1)",
		"jsonb_build_object('item_id', item_id, 'count', quantity)",
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
		if len(children) != 2 {
			t.Fatalf("contents must contain item and quantity fields: %#v", field)
		}
		return
	}
	t.Fatal("item_2 schema must expose pack contents")
}

func TestStartingShopResourceSchemasExposeSharedFlag(t *testing.T) {
	for _, typeID := range []string{"1", "2", "10", "12", "13"} {
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

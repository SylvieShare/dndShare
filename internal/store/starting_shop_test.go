package store

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestArmorCatalogSchemaIsEmbeddedLast(t *testing.T) {
	if len(schemaParts) == 0 {
		t.Fatal("schemaParts is empty")
	}
	last := schemaParts[len(schemaParts)-1]
	if last.name != "armor-catalog" || last.sql == "" || last.sql != schemaArmorCatalogSQL {
		t.Fatal("armor-catalog schema must be embedded as the final startup migration")
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
	} {
		if !strings.Contains(schemaStartingShopSQL, fragment) {
			t.Fatalf("starting shop schema must contain %q", fragment)
		}
	}
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

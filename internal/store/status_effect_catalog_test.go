package store

import (
	"strings"
	"testing"
)

func TestStatusEffectCatalogSeedsThesisAndSpecialEffects(t *testing.T) {
	for _, fragment := range []string{
		"\"key\":\"thesis\",\"type\":\"textarea\"",
		"- Уровни накапливают штрафы\\n- Продолжительный отдых снимает один уровень",
		"- Преимущество на один бросок атаки, проверки или спасброска",
		"- Помеха к проверкам характеристик и броскам атаки\\n- Не может переместиться ближе к источнику испуга",
		"('rage', 'Ярость', E'- Преимущество к проверкам и спасброскам Силы",
		"INSERT INTO dndshare.item (name, data, type_id)",
		"data ->> 'code' = 'exhaustion'",
		"data ->> 'code' = 'inspiration'",
		"static-status-effect-media/v1/",
		"icon_image_id = icon.id",
		"cover_image_id = cover.id",
	} {
		if !strings.Contains(schemaStatusEffectCatalogSQL, fragment) {
			t.Fatalf("status effect catalogue schema missing %q", fragment)
		}
	}
}

func TestStatusSuggestIsRemovedAfterItemMigration(t *testing.T) {
	for _, fragment := range []string{
		"status_effect_items_version",
		"effect.data ->> 'legacy_suggest_id'",
		"DELETE FROM dndshare.suggest WHERE type_id = 9",
		"DELETE FROM dndshare.suggest_type WHERE id = 9",
	} {
		if !strings.Contains(schemaRemoveStatusSuggestSQL, fragment) {
			t.Fatalf("status suggest removal schema missing %q", fragment)
		}
	}
}

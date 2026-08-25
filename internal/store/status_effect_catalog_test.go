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
		"('rage', E'- Преимущество к проверкам и спасброскам Силы",
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

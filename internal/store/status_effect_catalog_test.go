package store

import (
	"strings"
	"testing"
)

func TestStatusEffectCatalogSeedsThesisAndSpecialEffects(t *testing.T) {
	for _, fragment := range []string{
		"\"key\":\"thesis\"",
		"Штрафы растут с уровнем.",
		"Преимущество на один бросок.",
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

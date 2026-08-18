package web

import "testing"

func TestBestiaryImageURLSelectsSupportedCDNImage(t *testing.T) {
	detail := map[string]any{
		"images": []any{
			"https://example.com/not-supported.webp",
			ttgImagePrefix + "adult-red-dragon.webp",
			ttgImagePrefix + "unused-second.webp",
		},
	}

	got := bestiaryImageURL(detail)
	want := ttgImagePrefix + "adult-red-dragon.webp"
	if got != want {
		t.Fatalf("bestiaryImageURL() = %q, want %q", got, want)
	}
}

func TestBestiaryImageURLReturnsEmptyWithoutSupportedImage(t *testing.T) {
	for _, detail := range []any{
		nil,
		map[string]any{},
		map[string]any{"images": []any{"https://example.com/creature.webp"}},
	} {
		if got := bestiaryImageURL(detail); got != "" {
			t.Fatalf("bestiaryImageURL(%v) = %q, want empty", detail, got)
		}
	}
}

func TestBestiarySourceReadsPublicationMetadata(t *testing.T) {
	detail := map[string]any{
		"source": map[string]any{
			"shortName": "MM",
			"name":      "Бестиарий",
		},
	}

	code, name := bestiarySource(detail)
	if code != "MM" || name != "Бестиарий" {
		t.Fatalf("bestiarySource() = (%q, %q), want (%q, %q)", code, name, "MM", "Бестиарий")
	}
}

func TestBestiarySourceFallsBackToCode(t *testing.T) {
	code, name := bestiarySource(map[string]any{
		"source": map[string]any{"shortName": "VGM"},
	})
	if code != "VGM" || name != "VGM" {
		t.Fatalf("bestiarySource() = (%q, %q), want code fallback", code, name)
	}
}

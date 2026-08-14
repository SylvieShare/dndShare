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

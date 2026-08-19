package store

import "testing"

func TestImportedBestiaryImageRecognition(t *testing.T) {
	legacyType := "bestiary"
	coverType := "item_cover"
	legacyKey := "bestiary/v1/kobold.webp"
	generatedKey := "system-item-media/v1/items/1/cover/hash.jpg"

	if !isImportedBestiaryImage(&legacyType, nil) {
		t.Fatal("legacy bestiary media type must remain importer-owned")
	}
	if !isImportedBestiaryImage(&coverType, &legacyKey) {
		t.Fatal("migrated bestiary key must remain importer-owned")
	}
	if isImportedBestiaryImage(&coverType, &generatedKey) {
		t.Fatal("generated item cover must not be overwritten by the importer")
	}
}

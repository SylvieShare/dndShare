package store

import (
	"strings"
	"testing"
)

func TestCharacterIconUsesStorageImageReference(t *testing.T) {
	for _, fragment := range []string{
		"icon_image_id   int8 NULL REFERENCES dndshare.storage_image(id) ON DELETE SET NULL",
		"ADD COLUMN IF NOT EXISTS icon_image_id int8 NULL REFERENCES dndshare.storage_image(id) ON DELETE SET NULL",
		"idx_char_icon_image_id",
	} {
		if !strings.Contains(schemaCharactersSQL, fragment) {
			t.Fatalf("character schema must contain %q", fragment)
		}
	}
}

func TestCharacterIconProtectsReferencedStorageObject(t *testing.T) {
	if !strings.Contains(markStorageImageDeletedIfUnreferencedSQL, `dndshare."char" character WHERE character.icon_image_id = img.id`) {
		t.Fatal("character icon must keep its storage image active while referenced")
	}
}

func TestCharacterProjectionIncludesActiveIcon(t *testing.T) {
	for _, fragment := range []string{"c.icon_image_id", "image.id = c.icon_image_id", "image.deleted = false"} {
		if !strings.Contains(characterCols, fragment) {
			t.Fatalf("character projection must contain %q", fragment)
		}
	}
}

func TestCharacterIconWriteAllowsOwnerOrSessionGM(t *testing.T) {
	for _, fragment := range []string{
		"character.user_id = $2",
		"dndshare.session_participant",
		`dndshare."session"`,
		"participant.char_id = character.id",
		"session.owner_user_id = $2",
		"session.deleted = false",
		"FOR UPDATE",
	} {
		if !strings.Contains(characterIconWriteAccessSQL, fragment) {
			t.Fatalf("character icon write access must contain %q", fragment)
		}
	}
}

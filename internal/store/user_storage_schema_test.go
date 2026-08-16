package store

import (
	"strings"
	"testing"
)

func TestUserStorageSchemaTracksUploadedObjectMetadata(t *testing.T) {
	for _, fragment := range []string{
		"ADD COLUMN IF NOT EXISTS file_size int8",
		"ADD COLUMN IF NOT EXISTS file_name",
		"ADD COLUMN IF NOT EXISTS mime_type",
		"file_size = octet_length(bytes)",
		"storage_image_file_size_check",
		"idx_storage_image_user_created",
		"ALTER TABLE dndshare.svg_storage",
		"ADD COLUMN IF NOT EXISTS user_id int8",
		"octet_length(convert_to(\"data\", 'UTF8'))",
		"idx_svg_storage_user_created",
	} {
		if !strings.Contains(schemaUserStorageSQL, fragment) {
			t.Fatalf("user storage schema must contain %q", fragment)
		}
	}
}

func TestAccountStorageQueryNamesComputedMimeColumn(t *testing.T) {
	if !strings.Contains(accountStorageFilesQuery, "COALESCE(image.mime_type, '') AS mime_type") {
		t.Fatal("account storage union must expose the computed MIME column as mime_type")
	}
}

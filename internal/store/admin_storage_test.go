package store

import (
	"strings"
	"testing"
)

func TestAdminStorageStatsQueryCoversManagedFileKinds(t *testing.T) {
	for _, fragment := range []string{
		"'systemImages'",
		"'userImages'",
		"'video'",
		"'systemMusic'",
		"'userMusic'",
		"'svg'",
		"FROM dndshare.storage_image image",
		"FROM dndshare.svg_storage svg",
		"FROM dndshare.music_track track",
		"image.deleted = false",
		`image."key" IS NOT NULL OR image.bytes IS NOT NULL`,
		"stored_files.file_size IS NULL",
	} {
		if !strings.Contains(adminStorageStatsQuery, fragment) {
			t.Fatalf("admin storage query must contain %q", fragment)
		}
	}
}

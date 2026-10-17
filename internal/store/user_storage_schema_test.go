package store

import (
	"strings"
	"testing"
)

func TestAccountStorageQueryNamesComputedMimeColumn(t *testing.T) {
	if !strings.Contains(accountStorageFilesQuery, "COALESCE(image.mime_type, '') AS mime_type") {
		t.Fatal("account storage union must expose the computed MIME column as mime_type")
	}
}

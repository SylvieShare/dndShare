package web

import (
	"net/http/httptest"
	"testing"

	"dndshare/internal/store"
)

func TestValidateAccountPasswordRequest(t *testing.T) {
	recorder := httptest.NewRecorder()
	if !validateAccountPasswordRequest(recorder, accountPasswordRequest{CurrentPassword: "old-pass", NewPassword: "new-pass"}) {
		t.Fatalf("valid password change rejected: %s", recorder.Body.String())
	}
	recorder = httptest.NewRecorder()
	if validateAccountPasswordRequest(recorder, accountPasswordRequest{CurrentPassword: "same", NewPassword: "same"}) {
		t.Fatal("unchanged password accepted")
	}
}

func TestAccountStorageSummaryGroupsKnownAndUnknownFiles(t *testing.T) {
	imageSize := int64(120)
	musicSize := int64(380)
	result := accountStorageSummary([]store.AccountStorageFile{
		{Kind: "image", FileSize: &imageSize},
		{Kind: "video"},
		{Kind: "music", FileSize: &musicSize},
	})
	if result.UsedBytes != 500 || result.FileCount != 3 || result.UnknownFileCount != 1 {
		t.Fatalf("unexpected totals: %+v", result)
	}
	if len(result.Breakdown) != 3 || result.Breakdown[0].Kind != "image" || result.Breakdown[1].Kind != "video" || result.Breakdown[2].Kind != "music" {
		t.Fatalf("unexpected breakdown: %+v", result.Breakdown)
	}
}

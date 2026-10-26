package web

import (
	"net/http"
	"testing"

	"dndshare/internal/store"
)

func TestHandbookCursorBinding(t *testing.T) {
	valid := handbookSyncCursor{Protocol: 1, UserID: 10, SourceID: 1,
		Position: store.HandbookSyncPosition{Revision: 4, BaseRevision: 4}}
	raw := encodeHandbookCursor(valid)
	if _, err := decodeHandbookCursor(raw, 10, 1); err != nil {
		t.Fatal(err)
	}
	for _, input := range []struct {
		value        string
		user, source int64
	}{
		{raw, 20, 1}, {raw, 10, 2}, {"broken", 10, 1},
	} {
		if _, err := decodeHandbookCursor(input.value, input.user, input.source); err == nil {
			t.Fatal("accepted a cursor from another scope or malformed data")
		}
	}
	valid.Page = true
	valid.Position = store.HandbookSyncPosition{BaseRevision: -1, Revision: 4, LastID: 9, MaxID: 8}
	if _, err := decodeHandbookCursor(encodeHandbookCursor(valid), 10, 1); err == nil {
		t.Fatal("accepted invalid page bounds")
	}
}

func TestHandbookSyncHTTPPostgres(t *testing.T) {
	f := newAuthHTTPFixture(t)
	client := authClient(t)
	f.request(client, "GET", "/api/handbook/sync?sourceId=1", "", http.StatusUnauthorized)
	f.request(client, "POST", "/api/user/registration", `{"login":"native","password":"native-password"}`, http.StatusOK)
	f.request(client, "GET", "/api/handbook/sync?sourceId=bad", "", http.StatusBadRequest)
	body, response := f.request(client, "GET", "/api/handbook/sync?sourceId=1&limit=1", "", http.StatusOK)
	if body["protocol"] != float64(1) || body["full"] != true || body["hasMore"] != false ||
		body["cursor"] == nil || body["visibleIds"] == nil || response.Header.Get("Cache-Control") != "no-store" {
		t.Fatalf("invalid first sync contract: %+v", body)
	}
	cursor := body["cursor"].(string)
	delta, _ := f.request(client, "GET", "/api/handbook/sync?sourceId=1&cursor="+cursor, "", http.StatusOK)
	if delta["full"] != false || len(delta["entries"].([]any)) != 0 {
		t.Fatalf("unchanged sync should return a valid empty delta: %+v", delta)
	}
	other := authClient(t)
	f.request(other, "POST", "/api/user/registration", `{"login":"other","password":"other-password"}`, http.StatusOK)
	f.request(other, "GET", "/api/handbook/sync?sourceId=1&cursor="+cursor, "", http.StatusConflict)
}

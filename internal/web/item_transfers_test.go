package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestTransferRequestValidation(t *testing.T) {
	version := int64(3)
	valid := itemTransferRequest{SessionUUID: "00000000-0000-4000-8000-000000000001", RecipientCharUUID: "00000000-0000-4000-8000-000000000002", ClientActionID: "00000000-0000-4000-8000-000000000003", Source: "items", EntryUID: "item-1", Version: &version}
	if !validItemTransferRequest(valid) {
		t.Fatal("valid request rejected")
	}
	for _, change := range []func(*itemTransferRequest){
		func(r *itemTransferRequest) { r.Purpose = "other" },
		func(r *itemTransferRequest) { r.Source = "abilities" }, func(r *itemTransferRequest) { r.EntryUID = "" },
		func(r *itemTransferRequest) { r.Version = nil }, func(r *itemTransferRequest) { r.ClientActionID = "bad" },
		func(r *itemTransferRequest) { r.RecipientCharUUID = "bad" }, func(r *itemTransferRequest) { r.SessionUUID = "bad" },
	} {
		r := valid
		change(&r)
		if validItemTransferRequest(r) {
			t.Fatalf("accepted invalid request %+v", r)
		}
	}
	valid.Purpose = "use"
	for _, source := range []string{"potions", "weapon", "items"} {
		valid.Source = source
		if !validItemTransferRequest(valid) {
			t.Fatalf("valid %s application rejected", source)
		}
	}
	valid.RecipientCharUUID = "dm"
	if !validItemTransferRequest(valid) {
		t.Fatal("DM potion rejected")
	}
	valid.Source = "spells"
	if !validItemTransferRequest(valid) {
		t.Fatal("DM spell rejected")
	}
	valid.Purpose = "transfer"
	if validItemTransferRequest(valid) {
		t.Fatal("spell transfer accepted")
	}
	valid.Source = "items"
	if !validItemTransferRequest(valid) {
		t.Fatal("DM inventory transfer rejected")
	}
	if allowedSessionEventTypes["item_transfer"] {
		t.Fatal("clients must not forge transfer chronicle events")
	}
}
func TestTransferRoutesRequireAuthentication(t *testing.T) {
	s := &Server{}
	mux := http.NewServeMux()
	s.routesItemTransfers(mux)
	s.routesSessionInventory(mux)
	for _, path := range []string{"GET /api/sessions/test/inventory", "POST /api/sessions/test/inventory", "DELETE /api/sessions/test/inventory/item", "POST /api/sessions/test/inventory/item/transfer", "GET /api/char/test/item-transfers", "POST /api/char/test/item-transfers", "POST /api/char/test/item-transfers/1/resolve"} {
		parts := strings.SplitN(path, " ", 2)
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, httptest.NewRequest(parts[0], parts[1], nil))
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("%s: %d", path, response.Code)
		}
	}
}
func TestPendingTransferDeletionExplainsConflict(t *testing.T) {
	response := httptest.NewRecorder()
	serverError(response, &pgconn.PgError{Code: "PIT01"})
	if response.Code != 409 || !strings.Contains(response.Body.String(), "передачи предметов") {
		t.Fatalf("%d %s", response.Code, response.Body.String())
	}
}

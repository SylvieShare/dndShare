package web

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestRemovedInventoryCountersReturnActionableBadRequest(t *testing.T) {
	response := httptest.NewRecorder()
	serverError(response, fmt.Errorf("save character: %w", &pgconn.PgError{
		Code: "23514", ConstraintName: "character_without_inventory_counters",
	}))
	var body errorBody
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusBadRequest || body.Desc == nil ||
		*body.Desc != "Обновите страницу: плитки больше не поддерживаются" {
		t.Fatalf("response: %d %s", response.Code, response.Body.String())
	}
}

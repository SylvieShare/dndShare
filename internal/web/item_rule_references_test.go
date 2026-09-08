package web

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRuleReferencesRejectInvalidParameters(t *testing.T) {
	s := &Server{}
	for _, query := range []string{"kind=unknown", "kind=resource&itemId=-1", "kind=status&excludeItemId=bad"} {
		t.Run(query, func(t *testing.T) {
			w := httptest.NewRecorder()
			s.handleItemRuleReferences(w, httptest.NewRequest(http.MethodGet, "/api/items/rule-references?"+query, nil))
			if w.Code != http.StatusBadRequest {
				t.Fatalf("want 400, got %d", w.Code)
			}
		})
	}
}

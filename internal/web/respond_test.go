package web

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestJSONResponseCanBeReadByBrowserAfterEmptySuccess(t *testing.T) {
	w := httptest.NewRecorder()
	writeJSON(w, http.StatusOK, nil)
	var value any
	if err := json.Unmarshal(w.Body.Bytes(), &value); err != nil || value != nil {
		t.Fatalf("successful empty JSON result must be valid null: %q, %v", w.Body.String(), err)
	}
	for _, status := range []int{http.StatusNoContent, http.StatusNotModified} {
		w := httptest.NewRecorder()
		writeJSON(w, status, nil)
		if w.Code != status || w.Body.Len() != 0 {
			t.Fatalf("body on %d: %q", status, w.Body.String())
		}
	}
}

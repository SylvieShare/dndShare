package web

import (
	"net/http/httptest"
	"testing"
	"time"
)

func TestOccurrenceValidation(t *testing.T) {
	valid := occurrenceRequest{Number: 1, Name: "  Встреча  ", Date: "2024-02-29", ExpectedChangedAt: time.Now()}
	w := httptest.NewRecorder()
	m, ok := cleanOccurrence(w, valid, true)
	if !ok || m.Name != "Встреча" || m.Date != "2024-02-29" {
		t.Fatalf("valid meeting rejected: %+v", m)
	}
	for _, modify := range []func(*occurrenceRequest){
		func(r *occurrenceRequest) { r.Date = "2025-02-29" },
		func(r *occurrenceRequest) { r.Date = "2026-10-03T23:00:00Z" },
		func(r *occurrenceRequest) { r.Date = "" },
		func(r *occurrenceRequest) { r.Number = 0 },
		func(r *occurrenceRequest) { r.Number = 1000001 },
		func(r *occurrenceRequest) { r.Name = "  " },
		func(r *occurrenceRequest) { r.ExpectedChangedAt = time.Time{} },
	} {
		req := valid
		modify(&req)
		w := httptest.NewRecorder()
		if _, ok := cleanOccurrence(w, req, true); ok || w.Code != 400 {
			t.Fatalf("accepted invalid meeting: %+v", req)
		}
	}
}

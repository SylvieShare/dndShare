package web

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestJournalQuestValidation(t *testing.T) {
	for _, tc := range []struct {
		name, payload string
		valid         bool
	}{
		{"empty draft", `{"quest":{"objectives":[],"reward":""}}`, true},
		{"checklist", `{"quest":{"objectives":[{"id":"one","text":"Найти ключ","done":true}],"reward":"150 зм"}}`, true},
		{"missing quest", `{}`, false},
		{"null quest", `{"quest":null}`, false},
		{"wrong done type", `{"quest":{"objectives":[{"id":"one","text":"Ключ","done":"yes"}]}}`, false},
		{"empty text", `{"quest":{"objectives":[{"id":"one","text":"  "}]}}`, false},
		{"duplicate id", `{"quest":{"objectives":[{"id":"one","text":"A"},{"id":"one","text":"B"}]}}`, false},
		{"long reward", `{"quest":{"reward":"` + strings.Repeat("я", 2001) + `"}}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			_, ok := cleanJournalEntry(w, journalEntryRequest{Type: "quest", Payload: json.RawMessage(tc.payload)})
			if ok != tc.valid {
				t.Fatalf("valid=%v, want %v; %s", ok, tc.valid, w.Body.String())
			}
		})
	}
}

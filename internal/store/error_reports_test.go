package store

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestAnonymousErrorReportSerializesNullUser(t *testing.T) {
	raw, err := json.Marshal(ErrorReport{})
	if err != nil {
		t.Fatalf("marshal report: %v", err)
	}
	jsonText := string(raw)
	for _, field := range []string{`"userId":null`, `"userLogin":null`} {
		if !strings.Contains(jsonText, field) {
			t.Fatalf("anonymous reporter field %s missing from %s", field, jsonText)
		}
	}
}

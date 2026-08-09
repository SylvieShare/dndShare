package store

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestAnonymousErrorReportSerializesNullUser(t *testing.T) {
	raw, err := json.Marshal(ErrorReport{Messages: []ErrorReportMessage{}})
	if err != nil {
		t.Fatalf("marshal report: %v", err)
	}
	jsonText := string(raw)
	for _, field := range []string{`"userId":null`, `"userLogin":null`, `"approved":false`, `"messages":[]`, `"waitingForAnswer":false`} {
		if !strings.Contains(jsonText, field) {
			t.Fatalf("anonymous reporter field %s missing from %s", field, jsonText)
		}
	}
}

func TestErrorReportMessageSerializesNullableAdmin(t *testing.T) {
	raw, err := json.Marshal(ErrorReportMessage{Sender: ErrorReportMessageSenderAI, Message: "Нужны шаги воспроизведения"})
	if err != nil {
		t.Fatalf("marshal message: %v", err)
	}
	jsonText := string(raw)
	for _, field := range []string{`"sender":"AI"`, `"adminUserId":null`, `"adminUserLogin":null`} {
		if !strings.Contains(jsonText, field) {
			t.Fatalf("message field %s missing from %s", field, jsonText)
		}
	}
}

package store

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestAnonymousErrorReportSerializesNullUser(t *testing.T) {
	raw, err := json.Marshal(ErrorReport{Status: ErrorReportStatusOpen, Messages: []ErrorReportMessage{}})
	if err != nil {
		t.Fatalf("marshal report: %v", err)
	}
	jsonText := string(raw)
	for _, field := range []string{`"userId":null`, `"userLogin":null`, `"approved":false`, `"status":"OPEN"`, `"resolution":null`, `"resolvedCommitSha":null`, `"resolvedAt":null`, `"messages":[]`, `"waitingForAnswer":false`} {
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

func TestErrorReportProcessingRunIDIsStableAndDoesNotExposeLease(t *testing.T) {
	const leaseID = "super-secret-lease-handle"
	first := errorReportProcessingRunID(leaseID)
	second := errorReportProcessingRunID(leaseID)
	if first != second {
		t.Fatalf("processing run id is not stable: %q != %q", first, second)
	}
	if first == leaseID || len(first) != 16 {
		t.Fatalf("processing run id must be a short non-secret handle, got %q", first)
	}
}

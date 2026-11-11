package web

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"dndshare/internal/store"
)

func TestErrorReportLeaseID(t *testing.T) {
	first, err := newErrorReportLeaseID()
	if err != nil {
		t.Fatalf("generate first lease id: %v", err)
	}
	second, err := newErrorReportLeaseID()
	if err != nil {
		t.Fatalf("generate second lease id: %v", err)
	}
	if len(first) != 32 || len(second) != 32 {
		t.Fatalf("unexpected lease id lengths: %d and %d", len(first), len(second))
	}
	if first == second {
		t.Fatal("lease ids must be unique")
	}
}

func TestErrorReportLeaseIDArgRequiresCurrentField(t *testing.T) {
	leaseID, err := errorReportLeaseIDArg(map[string]json.RawMessage{
		"leaseId": json.RawMessage(`"new-handle"`),
	})
	if err != nil || leaseID != "new-handle" {
		t.Fatalf("unexpected leaseId result: %q, %v", leaseID, err)
	}
	_, err = errorReportLeaseIDArg(map[string]json.RawMessage{
		"token": json.RawMessage(`"removed-handle"`),
	})
	if err == nil {
		t.Fatal("removed token alias must be rejected")
	}
}

func TestArgBoolDefault(t *testing.T) {
	value, err := argBoolDefault(map[string]json.RawMessage{
		"summaryOnly": json.RawMessage(`true`),
	}, "summaryOnly", false)
	if err != nil || !value {
		t.Fatalf("unexpected boolean result: %v, %v", value, err)
	}
	value, err = argBoolDefault(map[string]json.RawMessage{}, "summaryOnly", false)
	if err != nil || value {
		t.Fatalf("unexpected default boolean result: %v, %v", value, err)
	}
	if _, err := argBoolDefault(map[string]json.RawMessage{
		"summaryOnly": json.RawMessage(`"yes"`),
	}, "summaryOnly", false); err == nil {
		t.Fatal("expected non-boolean summaryOnly to fail")
	}
}

func TestErrorReportListProbeOnlyExposesQueuePresence(t *testing.T) {
	empty := newErrorReportListProbe(false)
	if empty.HasReports {
		t.Fatal("empty queue must not report work")
	}
	probe := newErrorReportListProbe(true)
	raw, err := json.Marshal(probe)
	if err != nil {
		t.Fatalf("marshal probe: %v", err)
	}
	if string(raw) != `{"hasReports":true}` {
		t.Fatalf("unexpected probe payload: %s", raw)
	}
}

func TestCompactErrorReportsPreserveEvidenceAndOmitWorkflowFields(t *testing.T) {
	title := "Не виден акцент"
	login := "tester"
	source := []store.ErrorReport{{
		ID:                    84,
		Title:                 &title,
		Description:           "Кубик выглядит серым",
		PageURL:               "/character/1",
		Element:               json.RawMessage(`{"selector":".dice"}`),
		UserLogin:             &login,
		Approved:              true,
		Status:                store.ErrorReportStatusOpen,
		HasScreenshot:         true,
		HasViewportScreenshot: false,
		Messages:              []store.ErrorReportMessage{},
		CreatedAt:             time.Unix(1, 0).UTC(),
	}}
	compact := newCompactErrorReportList(source)

	raw, err := json.Marshal(compact)
	if err != nil {
		t.Fatalf("marshal compact reports: %v", err)
	}
	value := string(raw)
	for _, expected := range []string{`"ids":[84]`, `"reports":[{`, `"id":84`, `"title":"Не виден акцент"`, `"description":"Кубик выглядит серым"`, `"pageUrl":"/character/1"`, `"element":{"selector":".dice"}`, `"userLogin":"tester"`, `"hasScreenshot":true`, `"messages":[]`} {
		if !strings.Contains(value, expected) {
			t.Fatalf("compact evidence %s missing from %s", expected, value)
		}
	}
	for _, omitted := range []string{`"approved"`, `"status"`, `"processingRunId"`, `"resolution"`, `"resolvedCommitSha"`, `"waitingForAnswer"`} {
		if strings.Contains(value, omitted) {
			t.Fatalf("workflow field %s leaked into %s", omitted, value)
		}
	}
	full, err := json.Marshal(source)
	if err != nil {
		t.Fatalf("marshal full reports: %v", err)
	}
	if len(raw) >= len(full) {
		t.Fatalf("compact payload must be smaller: compact=%d full=%d", len(raw), len(full))
	}
}

func TestCompactErrorReportListUsesNumericIDsAndEmptyArrays(t *testing.T) {
	compact := newCompactErrorReportList(nil)
	raw, err := json.Marshal(compact)
	if err != nil {
		t.Fatalf("marshal empty compact list: %v", err)
	}
	if string(raw) != `{"ids":[],"reports":[]}` {
		t.Fatalf("unexpected empty compact list: %s", raw)
	}
}

func TestMCPImageContentIsTypedInsteadOfJSONText(t *testing.T) {
	result := mcpToolResult{Content: []mcpContent{
		{Type: "text", Text: "error report 7 element screenshot"},
		{Type: "image", Data: "YWJj", MimeType: "image/jpeg"},
	}}
	raw, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("marshal result: %v", err)
	}
	value := string(raw)
	if !strings.Contains(value, `"type":"image"`) || !strings.Contains(value, `"mimeType":"image/jpeg"`) {
		t.Fatalf("missing typed image content: %s", value)
	}
	if strings.Contains(value, `"text":"YWJj"`) {
		t.Fatalf("image bytes must not be exposed as text: %s", value)
	}
}

func TestDecodeErrorReportScreenshot(t *testing.T) {
	payload := []byte{0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43}
	dataURL := "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(payload)

	decoded, contentType, err := decodeErrorReportScreenshot(&dataURL)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(decoded) != string(payload) {
		t.Fatalf("decoded payload mismatch: %q", decoded)
	}
	if contentType == nil || *contentType != "image/jpeg" {
		t.Fatalf("content type mismatch: %v", contentType)
	}
}

func TestDecodeErrorReportScreenshotRejectsInvalidAndOversizedData(t *testing.T) {
	invalid := "data:text/html;base64,PGgxPm5vPC9oMT4="
	if _, _, err := decodeErrorReportScreenshot(&invalid); err == nil {
		t.Fatal("expected invalid content type to fail")
	}

	oversized := "data:image/png;base64," + strings.Repeat("A", 3*1024*1024)
	if _, _, err := decodeErrorReportScreenshot(&oversized); err == nil {
		t.Fatal("expected oversized screenshot to fail")
	}
}

func TestNormalizeErrorReportMessage(t *testing.T) {
	message, err := normalizeErrorReportMessage("  Что должно происходить после нажатия?  ")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if message != "Что должно происходить после нажатия?" {
		t.Fatalf("unexpected normalized message: %q", message)
	}
	if _, err := normalizeErrorReportMessage("   "); err == nil {
		t.Fatal("expected blank message to fail")
	}
	if _, err := normalizeErrorReportMessage(strings.Repeat("я", maxErrorReportMessageRunes+1)); err == nil {
		t.Fatal("expected oversized message to fail")
	}
}

func TestNormalizeErrorReportTitle(t *testing.T) {
	title, err := normalizeErrorReportTitle("  Не открывается окно морфа  ")
	if err != nil || title != "Не открывается окно морфа" {
		t.Fatalf("unexpected normalized title: %q, %v", title, err)
	}
	if _, err := normalizeErrorReportTitle("   "); err == nil {
		t.Fatal("expected blank title to fail")
	}
	if _, err := normalizeErrorReportTitle(strings.Repeat("я", maxErrorReportTitleRunes+1)); err == nil {
		t.Fatal("expected oversized title to fail")
	}
}

func TestNormalizeErrorReportCommitSHA(t *testing.T) {
	value := " 43485ee "
	sha, err := normalizeErrorReportCommitSHA(&value)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sha == nil || *sha != "43485ee" {
		t.Fatalf("unexpected normalized sha: %v", sha)
	}
	invalid := "not-a-sha"
	if _, err := normalizeErrorReportCommitSHA(&invalid); err == nil {
		t.Fatal("expected non-hex commit sha to fail")
	}
	empty := "   "
	if sha, err := normalizeErrorReportCommitSHA(&empty); err != nil || sha != nil {
		t.Fatalf("expected empty sha to become nil, got %v, %v", sha, err)
	}
}

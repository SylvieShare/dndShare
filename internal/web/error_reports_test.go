package web

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestErrorReportLeaseToken(t *testing.T) {
	first, err := newErrorReportLeaseToken()
	if err != nil {
		t.Fatalf("generate first token: %v", err)
	}
	second, err := newErrorReportLeaseToken()
	if err != nil {
		t.Fatalf("generate second token: %v", err)
	}
	if len(first) != 64 || len(second) != 64 {
		t.Fatalf("unexpected token lengths: %d and %d", len(first), len(second))
	}
	if first == second {
		t.Fatal("lease tokens must be unique")
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

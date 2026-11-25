package uuid

import (
	"strings"
	"testing"
)

func TestNewUUIDReturnsVersionFourUUID(t *testing.T) {
	value, err := New()
	if err != nil {
		t.Fatal(err)
	}
	if len(value) != 36 || value[14] != '4' || !strings.ContainsRune("89ab", rune(value[19])) {
		t.Fatalf("unexpected UUIDv4 %q", value)
	}
}

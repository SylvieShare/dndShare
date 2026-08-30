package storage

import (
	"io"
	"os"
	"strings"
	"testing"
)

func TestSpoolUploadKeepsBodyOutOfMemoryBufferAndRewinds(t *testing.T) {
	temp, err := spoolUpload(strings.NewReader("payload"), 7)
	if err != nil {
		t.Fatal(err)
	}
	name := temp.Name()
	defer os.Remove(name)
	defer temp.Close()

	data, err := io.ReadAll(temp)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "payload" {
		t.Fatalf("unexpected staged body %q", data)
	}
}

func TestSpoolUploadRejectsMismatchedSize(t *testing.T) {
	if _, err := spoolUpload(strings.NewReader("payload"), 3); err == nil {
		t.Fatal("size mismatch must fail")
	}
}

func TestNewUUIDReturnsVersionFourUUID(t *testing.T) {
	value, err := newUUID()
	if err != nil {
		t.Fatal(err)
	}
	if len(value) != 36 || value[14] != '4' || !strings.ContainsRune("89ab", rune(value[19])) {
		t.Fatalf("unexpected UUIDv4 %q", value)
	}
}

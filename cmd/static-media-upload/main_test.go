package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestVerifyStaticMediaBatchAndRejectTampering(t *testing.T) {
	directory := "../../scripts/static-media"
	if err := run(t.Context(), directory, false); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(directory, "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	var rows []image
	if err := json.Unmarshal(raw, &rows); err != nil {
		t.Fatal(err)
	}
	row := rows[0]
	row.Size++
	if _, err := readImage(directory, row); err == nil {
		t.Fatal("changed size accepted")
	}
	row = rows[0]
	row.FileName = "../outside.webp"
	if _, err := readImage(directory, row); err == nil {
		t.Fatal("path traversal accepted")
	}
	row = rows[0]
	row.SHA256 = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
	row.Key = "system-item-media/v1/static/test/" + row.SHA256 + ".webp"
	row.URL = "https://storage.yandexcloud.net/dndshare/" + row.Key
	if _, err := readImage(directory, row); err == nil {
		t.Fatal("changed bytes accepted")
	}
}

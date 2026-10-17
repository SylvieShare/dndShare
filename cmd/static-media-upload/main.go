// Upload the former embedded handbook artwork before migration 193 is deployed.
// This manual bootstrap command is not part of the application or regular deploy.
package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"dndshare/internal/config"
	"dndshare/internal/storage"
)

type image struct {
	FileName string `json:"fileName"`
	Size     int64  `json:"size"`
	SHA256   string `json:"sha256"`
	Key      string `json:"key"`
	URL      string `json:"url"`
}

func readImage(directory string, row image) ([]byte, error) {
	if filepath.Base(row.FileName) != row.FileName || row.FileName == "." || !strings.HasSuffix(row.FileName, ".webp") {
		return nil, fmt.Errorf("invalid filename %q", row.FileName)
	}
	if len(row.SHA256) != 64 || !strings.HasPrefix(row.Key, "system-item-media/v1/static/") ||
		!strings.HasSuffix(row.Key, "/"+row.SHA256+".webp") || strings.Contains(row.Key, "..") {
		return nil, fmt.Errorf("invalid content-addressed key for %s", row.FileName)
	}
	if row.URL != "https://storage.yandexcloud.net/dndshare/"+row.Key {
		return nil, fmt.Errorf("unexpected public URL for %s", row.FileName)
	}
	data, err := os.ReadFile(filepath.Join(directory, "assets", row.FileName))
	if err != nil {
		return nil, err
	}
	if row.Size <= 0 || row.Size > 10<<20 || int64(len(data)) != row.Size ||
		fmt.Sprintf("%x", sha256.Sum256(data)) != row.SHA256 || http.DetectContentType(data) != "image/webp" {
		return nil, fmt.Errorf("size, SHA-256 or MIME mismatch for %s", row.FileName)
	}
	return data, nil
}

func run(ctx context.Context, directory string, apply bool) error {
	manifest, err := os.ReadFile(filepath.Join(directory, "manifest.json"))
	if err != nil {
		return err
	}
	var rows []image
	if err := json.Unmarshal(manifest, &rows); err != nil {
		return err
	}
	if len(rows) != 17 {
		return fmt.Errorf("expected 17 handbook images, got %d", len(rows))
	}
	// Validate the entire batch before writing any S3 objects.
	data := make([][]byte, len(rows))
	seen := make(map[string]bool)
	for i, row := range rows {
		if seen[row.Key] {
			return fmt.Errorf("duplicate object key for %s", row.FileName)
		}
		seen[row.Key] = true
		data[i], err = readImage(directory, row)
		if err != nil {
			return err
		}
	}
	if !apply {
		log.Printf("verified %d local WebP files; use -apply to upload", len(rows))
		return nil
	}
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	if strings.TrimRight(cfg.Storage.PublicURL, "/") != "https://storage.yandexcloud.net/dndshare" {
		return fmt.Errorf("storage public URL must match migration 193")
	}
	objects := storage.New(cfg.Storage)
	for i, row := range rows {
		stored, err := objects.UploadSystemItemMedia(ctx, bytes.NewReader(data[i]), row.Size, row.Key, "image/webp")
		if err != nil {
			return fmt.Errorf("upload %s: %w", row.FileName, err)
		}
		if stored.URL != row.URL {
			return fmt.Errorf("unexpected uploaded URL for %s", row.FileName)
		}
		object, err := objects.GetObject(ctx, row.Key)
		if err != nil {
			return fmt.Errorf("read back %s: %w", row.FileName, err)
		}
		actual, readErr := io.ReadAll(io.LimitReader(object.Body, row.Size+1))
		object.Body.Close()
		if readErr != nil || !bytes.Equal(actual, data[i]) {
			return fmt.Errorf("S3 read-back differs for %s", row.FileName)
		}
		log.Printf("uploaded and verified %d/%d: %s (%d bytes)", i+1, len(rows), row.FileName, row.Size)
	}
	return nil
}

func main() {
	directory := flag.String("assets", "scripts/static-media", "directory containing manifest.json and assets/")
	apply := flag.Bool("apply", false, "upload and verify the manifest's S3 objects")
	flag.Parse()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, *directory, *apply); err != nil {
		log.Fatal(err)
	}
}

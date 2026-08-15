package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"dndshare/internal/config"
	"dndshare/internal/storage"
	"dndshare/internal/systemmusic"
)

func main() {
	sourceDir := flag.String("source-dir", "internal/systemmusic/tracks", "directory containing verified source audio")
	verifyOnly := flag.Bool("verify-only", false, "verify local files without uploading them")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	service := storage.New(cfg.Storage)
	for _, track := range systemmusic.Tracks {
		if err := upload(ctx, service, *sourceDir, track, *verifyOnly); err != nil {
			log.Fatal(err)
		}
		if *verifyOnly {
			log.Printf("verified %s", track.FileName)
			continue
		}
		log.Printf("uploaded %s -> s3://%s/%s", track.FileName, cfg.Storage.Bucket, track.ObjectKey)
	}
}

func upload(ctx context.Context, service *storage.Service, sourceDir string, track systemmusic.Track, verifyOnly bool) error {
	path := filepath.Join(sourceDir, track.FileName)
	file, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open %s: %w", path, err)
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return fmt.Errorf("stat %s: %w", path, err)
	}
	if info.Size() != track.Size {
		return fmt.Errorf("verify %s: size %d, want %d", path, info.Size(), track.Size)
	}
	digest := sha256.New()
	if _, err := io.Copy(digest, file); err != nil {
		return fmt.Errorf("hash %s: %w", path, err)
	}
	if actual := hex.EncodeToString(digest.Sum(nil)); actual != track.SHA256 {
		return fmt.Errorf("verify %s: SHA-256 %s, want %s", path, actual, track.SHA256)
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return fmt.Errorf("rewind %s: %w", path, err)
	}
	if verifyOnly {
		return nil
	}
	if _, err := service.UploadSystemAudio(ctx, file, info.Size(), track.ObjectKey, track.MimeType); err != nil {
		return fmt.Errorf("upload %s: %w", path, err)
	}
	storedSize, err := service.ObjectSize(ctx, track.ObjectKey)
	if err != nil {
		return fmt.Errorf("verify S3 object %s: %w", track.ObjectKey, err)
	}
	if storedSize != track.Size {
		return fmt.Errorf("verify S3 object %s: size %d, want %d", track.ObjectKey, storedSize, track.Size)
	}
	return nil
}

package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"log"
	"os/signal"
	"syscall"

	"dndshare/internal/config"
	"dndshare/internal/raceimages"
	"dndshare/internal/storage"
	"dndshare/internal/store"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	database, err := store.Open(ctx, cfg.DSN)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer database.Close()
	objects := storage.New(cfg.Storage)

	for index, image := range raceimages.Catalog {
		stored, err := uploadImage(ctx, objects, image)
		if err != nil {
			log.Fatal(err)
		}
		linked, err := database.UpsertSystemRaceImage(ctx, image.ObjectKey, stored.URL, image.FileName, image.MimeType, image.Size, image.Aliases, image.Subrace)
		if err != nil {
			log.Fatalf("register %s: %v", image.Key, err)
		}
		if linked == 0 {
			log.Fatalf("register %s: no race item matched aliases %v", image.Key, image.Aliases)
		}
		log.Printf("synced %d/%d: %s, linked items: %d", index+1, len(raceimages.Catalog), image.Key, linked)
	}
}

func uploadImage(ctx context.Context, objects *storage.Service, image raceimages.Image) (storage.StoredObject, error) {
	data, err := raceimages.Read(image)
	if err != nil {
		return storage.StoredObject{}, err
	}
	if int64(len(data)) != image.Size {
		return storage.StoredObject{}, fmt.Errorf("verify %s: size %d, want %d", image.FileName, len(data), image.Size)
	}
	digest := sha256.Sum256(data)
	if actual := hex.EncodeToString(digest[:]); actual != image.SHA256 {
		return storage.StoredObject{}, fmt.Errorf("verify %s: SHA-256 %s, want %s", image.FileName, actual, image.SHA256)
	}
	stored, err := objects.UploadRaceImage(ctx, bytes.NewReader(data), image.Size, image.ObjectKey, image.MimeType)
	if err != nil {
		return storage.StoredObject{}, fmt.Errorf("upload %s: %w", image.FileName, err)
	}
	storedSize, err := objects.ObjectSize(ctx, image.ObjectKey)
	if err != nil {
		return storage.StoredObject{}, fmt.Errorf("verify S3 object %s: %w", image.ObjectKey, err)
	}
	if storedSize != image.Size {
		return storage.StoredObject{}, fmt.Errorf("verify S3 object %s: size %d, want %d", image.ObjectKey, storedSize, image.Size)
	}
	return stored, nil
}

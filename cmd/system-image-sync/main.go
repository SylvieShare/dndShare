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
	"dndshare/internal/storage"
	"dndshare/internal/store"
	"dndshare/internal/systemimages"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	objects := storage.New(cfg.Storage)
	type uploadedImage struct {
		image  systemimages.Image
		stored storage.StoredObject
	}
	uploaded := make([]uploadedImage, 0, len(systemimages.Catalog))
	for _, image := range systemimages.Catalog {
		stored, err := uploadImage(ctx, objects, image)
		if err != nil {
			log.Fatal(err)
		}
		uploaded = append(uploaded, uploadedImage{image: image, stored: stored})
		log.Printf("uploaded %s -> s3://%s/%s", image.CatalogKey, cfg.Storage.Bucket, image.ObjectKey)
	}
	database, err := store.Open(ctx, cfg.DSN)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer database.Close()
	for _, item := range uploaded {
		if err := database.UpdateSystemSessionImageURL(ctx, item.image.CatalogKey, item.stored.Key, item.stored.URL); err != nil {
			log.Fatalf("update image catalog %s: %v", item.image.CatalogKey, err)
		}
		log.Printf("registered %s", item.image.CatalogKey)
	}
}

func uploadImage(ctx context.Context, objects *storage.Service, image systemimages.Image) (storage.StoredObject, error) {
	data, err := systemimages.Read(image)
	if err != nil {
		return storage.StoredObject{}, fmt.Errorf("read %s: %w", image.FileName, err)
	}
	if int64(len(data)) != image.Size {
		return storage.StoredObject{}, fmt.Errorf("verify %s: size %d, want %d", image.FileName, len(data), image.Size)
	}
	digest := sha256.Sum256(data)
	if actual := hex.EncodeToString(digest[:]); actual != image.SHA256 {
		return storage.StoredObject{}, fmt.Errorf("verify %s: SHA-256 %s, want %s", image.FileName, actual, image.SHA256)
	}
	stored, err := objects.UploadSystemImage(ctx, bytes.NewReader(data), image.Size, image.ObjectKey, image.MimeType)
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

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"dndshare/internal/bestiaryimages"
	"dndshare/internal/config"
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
	images, err := database.ListExternalBestiaryImages(ctx)
	if err != nil {
		log.Fatalf("list: %v", err)
	}
	if len(images) == 0 {
		log.Print("bestiary images already use S3")
		return
	}
	objects := storage.New(cfg.Storage)
	client := &http.Client{Timeout: 30 * time.Second}
	failures := 0
	for index, image := range images {
		stored, err := bestiaryimages.Upload(ctx, client, objects, image.URL, image.Slug)
		if err == nil {
			err = database.UpdateBestiaryImageStorage(ctx, image.ID, stored.Key, stored.URL)
		}
		if err != nil {
			failures++
			log.Printf("image %d (%s): %v", image.ID, image.Slug, err)
			continue
		}
		log.Printf("synced %d/%d: %s", index+1, len(images), image.Slug)
	}
	if failures > 0 {
		log.Fatal(fmt.Errorf("%d of %d bestiary images failed", failures, len(images)))
	}
}

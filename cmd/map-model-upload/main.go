package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"dndshare/internal/battlemap"
	"dndshare/internal/config"
	"dndshare/internal/storage"
)

func main() {
	dir := flag.String("assets", ".", "Folder with content-addressed assets and catalogue.json")
	flag.Parse()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	raw, err := os.ReadFile(filepath.Join(*dir, "catalogue.json"))
	if err != nil {
		log.Fatal(err)
	}
	var models []battlemap.Model
	if err = json.Unmarshal(raw, &models); err != nil {
		log.Fatal(err)
	}
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	objects := storage.New(cfg.Storage)
	for _, model := range models {
		for _, variant := range []string{"preview", "render", "lod", "source"} {
			asset, ok := model.Assets[variant]
			if !ok {
				log.Fatal("missing model variant " + variant)
			}
			if err = upload(ctx, objects, *dir, asset); err != nil {
				log.Fatalf("%s %s: %v", model.SourceCode, variant, err)
			}
			log.Printf("uploaded %s %s (%d bytes)", model.SourceCode, variant, asset.Size)
		}
	}
}

func upload(ctx context.Context, objects *storage.Service, dir string, asset battlemap.ModelAsset) error {
	file, err := os.Open(filepath.Join(dir, filepath.Base(asset.Key)))
	if err != nil {
		return err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return err
	}
	if info.Size() != asset.Size {
		return fmt.Errorf("asset size mismatch")
	}
	hash := sha256.New()
	if _, err = io.Copy(hash, file); err != nil {
		return err
	}
	if hex.EncodeToString(hash.Sum(nil)) != asset.SHA256 {
		return fmt.Errorf("asset checksum mismatch")
	}
	if _, err = file.Seek(0, io.SeekStart); err != nil {
		return err
	}
	if _, err = objects.UploadMapAsset(ctx, file, asset.Size, asset.Key, asset.MimeType); err != nil {
		return err
	}
	size, err := objects.ObjectSize(ctx, asset.Key)
	if err != nil {
		return err
	}
	if size != asset.Size {
		return fmt.Errorf("S3 asset size mismatch")
	}
	return nil
}

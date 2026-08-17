package bestiaryimages

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"path"
	"regexp"
	"strings"

	"dndshare/internal/storage"
)

const MaxBytes = 15 << 20

var slugCleaner = regexp.MustCompile(`[^a-zA-Z0-9_-]+`)

// Upload copies one remote creature image into our S3 under an idempotent key.
func Upload(ctx context.Context, client *http.Client, objects *storage.Service, sourceURL, slug string) (storage.StoredObject, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return storage.StoredObject{}, err
	}
	res, err := client.Do(req)
	if err != nil {
		return storage.StoredObject{}, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return storage.StoredObject{}, fmt.Errorf("download returned HTTP %d", res.StatusCode)
	}
	contentType := strings.TrimSpace(strings.Split(res.Header.Get("Content-Type"), ";")[0])
	if !strings.HasPrefix(contentType, "image/") {
		return storage.StoredObject{}, fmt.Errorf("download returned %q instead of an image", contentType)
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, MaxBytes+1))
	if err != nil {
		return storage.StoredObject{}, err
	}
	if len(data) > MaxBytes {
		return storage.StoredObject{}, fmt.Errorf("image exceeds %d MiB", MaxBytes>>20)
	}
	key, err := ObjectKey(req.URL.Path, slug)
	if err != nil {
		return storage.StoredObject{}, err
	}
	return objects.UploadBestiaryImage(ctx, bytes.NewReader(data), int64(len(data)), key, contentType)
}

func ObjectKey(sourcePath, slug string) (string, error) {
	ext := path.Ext(sourcePath)
	if len(ext) < 2 || len(ext) > 6 {
		ext = ".img"
	}
	cleanSlug := strings.Trim(slugCleaner.ReplaceAllString(slug, "-"), "-")
	if cleanSlug == "" {
		return "", fmt.Errorf("empty image slug")
	}
	return "bestiary/v1/" + cleanSlug + strings.ToLower(ext), nil
}

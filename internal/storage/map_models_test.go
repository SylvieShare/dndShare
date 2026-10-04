package storage

import (
	"context"
	"net/url"
	"strings"
	"testing"

	"dndshare/internal/config"
)

func TestMapPresignedUploadIsTemporaryAndBounded(t *testing.T) {
	s := New(config.StorageConfig{Endpoint: "https://storage.yandexcloud.net", Region: "ru-central1", Bucket: "test-bucket", AccessKey: "test-key", SecretKey: "test-secret"})
	key, link, err := s.PresignMapUpload(context.Background(), "model/gltf-binary", 100, "glb")
	if err != nil {
		t.Fatal(err)
	}
	if !mapUploadKey.MatchString(key) || strings.HasPrefix(key, "map-models/") {
		t.Fatal("upload can target immutable model content")
	}
	u, err := url.Parse(link)
	if err != nil {
		t.Fatal(err)
	}
	if u.Query().Get("X-Amz-Expires") != "900" || !strings.HasSuffix(u.Path, key) {
		t.Fatal("unexpected upload expiry or object key")
	}
	if _, _, err := s.PresignMapUpload(context.Background(), "model/gltf-binary", 100, "../glb"); err == nil {
		t.Fatal("accepted unsafe upload extension")
	}
}

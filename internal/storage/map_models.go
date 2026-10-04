package storage

import (
	"context"
	"fmt"
	"io"
	"regexp"
)

var mapAssetKey = regexp.MustCompile(`^map-models/[0-9a-f]{64}\.(glb|stl|webp)$`)

func (s *Service) UploadMapAsset(ctx context.Context, body io.Reader, size int64, key, mime string) (StoredObject, error) {
	if !mapAssetKey.MatchString(key) {
		return StoredObject{}, fmt.Errorf("invalid map asset key")
	}
	if mime != "model/gltf-binary" && mime != "model/stl" && mime != "image/webp" {
		return StoredObject{}, fmt.Errorf("invalid map asset MIME type")
	}
	return s.put(ctx, body, size, key, mime)
}

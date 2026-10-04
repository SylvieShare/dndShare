package storage

import (
	"context"
	"fmt"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"io"
	"regexp"
	"time"
)

var mapAssetKey = regexp.MustCompile(`^map-models/[0-9a-f]{64}\.(glb|stl|webp)$`)
var mapUploadKey = regexp.MustCompile(`^map-model-uploads/[0-9a-f-]{36}\.(glb|stl|webp)$`)

func (s *Service) UploadMapAsset(ctx context.Context, body io.Reader, size int64, key, mime string) (StoredObject, error) {
	if !mapAssetKey.MatchString(key) {
		return StoredObject{}, fmt.Errorf("invalid map asset key")
	}
	if mime != "model/gltf-binary" && mime != "model/stl" && mime != "image/webp" {
		return StoredObject{}, fmt.Errorf("invalid map asset MIME type")
	}
	return s.put(ctx, body, size, key, mime)
}

func (s *Service) PresignMapUpload(ctx context.Context, mime string, size int64, ext string) (string, string, error) {
	id, err := newUUID()
	if err != nil {
		return "", "", err
	}
	key := "map-model-uploads/" + id + "." + ext
	if !mapUploadKey.MatchString(key) {
		return "", "", fmt.Errorf("invalid upload extension")
	}
	request, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{Bucket: aws.String(s.cfg.Bucket), Key: aws.String(key), ContentType: aws.String(mime), ContentLength: aws.Int64(size)}, s3.WithPresignExpires(15*time.Minute))
	if err != nil {
		return "", "", err
	}
	return key, request.URL, nil
}

func (s *Service) PromoteMapUpload(ctx context.Context, source, target, mime string) error {
	if !mapUploadKey.MatchString(source) || !mapAssetKey.MatchString(target) {
		return fmt.Errorf("invalid map asset keys")
	}
	_, err := s.client.CopyObject(ctx, &s3.CopyObjectInput{Bucket: aws.String(s.cfg.Bucket), Key: aws.String(target), CopySource: aws.String(s.cfg.Bucket + "/" + source), ContentType: aws.String(mime), MetadataDirective: types.MetadataDirectiveReplace})
	return err
}

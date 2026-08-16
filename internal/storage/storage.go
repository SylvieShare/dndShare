package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"regexp"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"dndshare/internal/config"
)

// Service — порт ObjectStorageService: загрузка/удаление объектов и presigned GET
// в S3-совместимое хранилище (Yandex Object Storage, path-style).
type Service struct {
	cfg       config.StorageConfig
	client    *s3.Client
	presign   *s3.PresignClient
	extRegexp *regexp.Regexp
}

// StoredObject — результат загрузки: ключ в бакете и публичный URL.
type StoredObject struct {
	Key string `json:"key"`
	URL string `json:"url"`
}

// New собирает S3-клиент со статическими креденшлами и path-style доступом.
func New(cfg config.StorageConfig) *Service {
	client := s3.New(s3.Options{
		Region:       cfg.Region,
		BaseEndpoint: aws.String(cfg.Endpoint),
		UsePathStyle: true,
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, ""),
	})
	return &Service{
		cfg:       cfg,
		client:    client,
		presign:   s3.NewPresignClient(client),
		extRegexp: regexp.MustCompile(`^[a-z0-9]{1,8}$`),
	}
}

// UploadAudio загружает аудиофайл; contentType, не начинающийся с audio/, заменяется на octet-stream.
func (s *Service) UploadAudio(ctx context.Context, body io.Reader, size int64, filename, contentType, folder string) (StoredObject, error) {
	if !strings.HasPrefix(contentType, "audio/") {
		contentType = "application/octet-stream"
	}
	return s.put(ctx, body, size, s.buildKey(filename, folder), contentType)
}

// UploadSystemAudio stores a catalog track under its stable, versioned object key.
func (s *Service) UploadSystemAudio(ctx context.Context, body io.Reader, size int64, key, contentType string) (StoredObject, error) {
	if !strings.HasPrefix(key, "system-music/") || strings.Contains(key, "..") {
		return StoredObject{}, fmt.Errorf("invalid system music object key %q", key)
	}
	if !strings.HasPrefix(contentType, "audio/") {
		return StoredObject{}, fmt.Errorf("invalid system music content type %q", contentType)
	}
	return s.put(ctx, body, size, key, contentType)
}

// UploadSystemImage stores a catalogue image under its stable, versioned object key.
func (s *Service) UploadSystemImage(ctx context.Context, body io.Reader, size int64, key, contentType string) (StoredObject, error) {
	if !strings.HasPrefix(key, "system-session-images/") || strings.Contains(key, "..") {
		return StoredObject{}, fmt.Errorf("invalid system session image object key %q", key)
	}
	if !strings.HasPrefix(contentType, "image/") {
		return StoredObject{}, fmt.Errorf("invalid system session image content type %q", contentType)
	}
	return s.put(ctx, body, size, key, contentType)
}

// UploadImage загружает изображение; contentType, не начинающийся с image/, заменяется на octet-stream.
func (s *Service) UploadImage(ctx context.Context, body io.Reader, size int64, filename, contentType, folder string) (StoredObject, error) {
	if !strings.HasPrefix(contentType, "image/") {
		contentType = "application/octet-stream"
	}
	return s.put(ctx, body, size, s.buildKey(filename, folder), contentType)
}

// UploadVideo uploads a video object while retaining its browser media type.
func (s *Service) UploadVideo(ctx context.Context, body io.Reader, size int64, filename, contentType, folder string) (StoredObject, error) {
	if !strings.HasPrefix(contentType, "video/") {
		contentType = "application/octet-stream"
	}
	return s.put(ctx, body, size, s.buildKey(filename, folder), contentType)
}

// UploadSVGBytes загружает SVG-разметку как image/svg+xml.
func (s *Service) UploadSVGBytes(ctx context.Context, data []byte, folder string) (StoredObject, error) {
	key := strings.TrimRight(folder, "/") + "/" + newUUID() + ".svg"
	return s.put(ctx, bytes.NewReader(data), int64(len(data)), key, "image/svg+xml")
}

// PresignGet выдаёт временную ссылку на объект.
func (s *Service) PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error) {
	req, err := s.presign.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.cfg.Bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(ttl))
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

// ObjectSize returns the current S3 object size for deployment verification.
func (s *Service) ObjectSize(ctx context.Context, key string) (int64, error) {
	result, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.cfg.Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return 0, err
	}
	return aws.ToInt64(result.ContentLength), nil
}

// DeleteObject удаляет объект по ключу.
func (s *Service) DeleteObject(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.cfg.Bucket),
		Key:    aws.String(key),
	})
	return err
}

func (s *Service) put(ctx context.Context, body io.Reader, size int64, key, contentType string) (StoredObject, error) {
	// aws-sdk-go-v2 требует seekable/known-length тело для подписи; читаем в память.
	data, err := io.ReadAll(body)
	if err != nil {
		return StoredObject{}, err
	}
	if int64(len(data)) != size {
		return StoredObject{}, fmt.Errorf("object %q size changed while reading: got %d, want %d", key, len(data), size)
	}
	_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.cfg.Bucket),
		Key:           aws.String(key),
		Body:          bytes.NewReader(data),
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(int64(len(data))),
	})
	if err != nil {
		return StoredObject{}, err
	}
	return StoredObject{Key: key, URL: s.buildURL(key)}, nil
}

func (s *Service) buildKey(filename, folder string) string {
	ext := ""
	if i := strings.LastIndex(filename, "."); i >= 0 {
		cand := strings.ToLower(filename[i+1:])
		if s.extRegexp.MatchString(cand) {
			ext = "." + cand
		}
	}
	prefix := strings.Trim(folder, "/")
	if prefix == "" {
		prefix = strings.TrimRight(s.cfg.KeyPrefix, "/")
	}
	return prefix + "/" + newUUID() + ext
}

func (s *Service) buildURL(key string) string {
	base := s.cfg.PublicURL
	if base == "" {
		base = fmt.Sprintf("%s/%s", s.cfg.Endpoint, s.cfg.Bucket)
	}
	return strings.TrimRight(base, "/") + "/" + key
}

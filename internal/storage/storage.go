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

// UploadImage загружает изображение; contentType, не начинающийся с image/, заменяется на octet-stream.
func (s *Service) UploadImage(ctx context.Context, body io.Reader, size int64, filename, contentType, folder string) (StoredObject, error) {
	if !strings.HasPrefix(contentType, "image/") {
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

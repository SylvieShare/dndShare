package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
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
	cfg         config.StorageConfig
	client      *s3.Client
	presign     *s3.PresignClient
	extRegexp   *regexp.Regexp
	uploadSlots chan struct{}
}

// StoredObject — результат загрузки: ключ в бакете и публичный URL.
type StoredObject struct {
	Key string `json:"key"`
	URL string `json:"url"`
}

// ObjectBody is a streamed object response used by authenticated same-origin
// previews that must be readable by browser canvas APIs.
type ObjectBody struct {
	Body          io.ReadCloser
	ContentType   string
	ContentLength int64
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
		cfg:         cfg,
		client:      client,
		presign:     s3.NewPresignClient(client),
		extRegexp:   regexp.MustCompile(`^[a-z0-9]{1,8}$`),
		uploadSlots: make(chan struct{}, 3),
	}
}

// UploadAudio загружает аудиофайл; contentType, не начинающийся с audio/, заменяется на octet-stream.
func (s *Service) UploadAudio(ctx context.Context, body io.Reader, size int64, filename, contentType, folder string) (StoredObject, error) {
	if !strings.HasPrefix(contentType, "audio/") {
		contentType = "application/octet-stream"
	}
	key, err := s.buildKey(filename, folder)
	if err != nil {
		return StoredObject{}, err
	}
	return s.put(ctx, body, size, key, contentType)
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

// UploadRaceImage stores built-in race cover artwork under a stable key.
func (s *Service) UploadRaceImage(ctx context.Context, body io.Reader, size int64, key, contentType string) (StoredObject, error) {
	if !strings.HasPrefix(key, "system-race-images/") || strings.Contains(key, "..") {
		return StoredObject{}, fmt.Errorf("invalid system race image object key %q", key)
	}
	if !strings.HasPrefix(contentType, "image/") {
		return StoredObject{}, fmt.Errorf("invalid system race image content type %q", contentType)
	}
	return s.put(ctx, body, size, key, contentType)
}

// UploadRaceIcon stores a compact built-in race emblem under its own stable
// namespace, independent from the larger race cover artwork.
func (s *Service) UploadRaceIcon(ctx context.Context, body io.Reader, size int64, key, contentType string) (StoredObject, error) {
	if !strings.HasPrefix(key, "system-race-icons/") || strings.Contains(key, "..") {
		return StoredObject{}, fmt.Errorf("invalid system race icon object key %q", key)
	}
	if contentType != "image/webp" {
		return StoredObject{}, fmt.Errorf("invalid system race icon content type %q", contentType)
	}
	return s.put(ctx, body, size, key, contentType)
}

// UploadClassImage stores built-in class artwork under a stable, versioned key.
func (s *Service) UploadClassImage(ctx context.Context, body io.Reader, size int64, key, contentType string) (StoredObject, error) {
	if !strings.HasPrefix(key, "system-class-images/") || strings.Contains(key, "..") {
		return StoredObject{}, fmt.Errorf("invalid system class image object key %q", key)
	}
	if !strings.HasPrefix(contentType, "image/") {
		return StoredObject{}, fmt.Errorf("invalid system class image content type %q", contentType)
	}
	return s.put(ctx, body, size, key, contentType)
}

// UploadSpellRune stores a built-in spell rune under a stable, versioned key.
func (s *Service) UploadSpellRune(ctx context.Context, body io.Reader, size int64, key, contentType string) (StoredObject, error) {
	if !strings.HasPrefix(key, "system-spell-runes/") || strings.Contains(key, "..") {
		return StoredObject{}, fmt.Errorf("invalid system spell rune object key %q", key)
	}
	if !strings.HasPrefix(contentType, "image/") {
		return StoredObject{}, fmt.Errorf("invalid system spell rune content type %q", contentType)
	}
	return s.put(ctx, body, size, key, contentType)
}

// UploadItemCover stores built-in handbook cover art under a stable key.
func (s *Service) UploadItemCover(ctx context.Context, body io.Reader, size int64, key, contentType string) (StoredObject, error) {
	if !strings.HasPrefix(key, "system-item-covers/") || strings.Contains(key, "..") {
		return StoredObject{}, fmt.Errorf("invalid system item cover object key %q", key)
	}
	if contentType != "image/webp" {
		return StoredObject{}, fmt.Errorf("invalid system item cover content type %q", contentType)
	}
	return s.put(ctx, body, size, key, contentType)
}

// UploadSystemItemMedia stores an image installed through MCP under the
// content-addressed system item namespace. The caller is responsible for
// validating slot-specific dimensions and size limits.
func (s *Service) UploadSystemItemMedia(ctx context.Context, body io.Reader, size int64, key, contentType string) (StoredObject, error) {
	if !strings.HasPrefix(key, "system-item-media/") || strings.Contains(key, "..") {
		return StoredObject{}, fmt.Errorf("invalid system item media object key %q", key)
	}
	switch contentType {
	case "image/jpeg", "image/png", "image/webp":
	default:
		return StoredObject{}, fmt.Errorf("invalid system item media content type %q", contentType)
	}
	return s.put(ctx, body, size, key, contentType)
}

// UploadBestiaryImage stores imported creature artwork under a stable key so a
// repeated catalogue import overwrites the object instead of leaking new ones.
func (s *Service) UploadBestiaryImage(ctx context.Context, body io.Reader, size int64, key, contentType string) (StoredObject, error) {
	if !strings.HasPrefix(key, "bestiary/") || strings.Contains(key, "..") {
		return StoredObject{}, fmt.Errorf("invalid bestiary image object key %q", key)
	}
	if !strings.HasPrefix(contentType, "image/") {
		return StoredObject{}, fmt.Errorf("invalid bestiary image content type %q", contentType)
	}
	return s.put(ctx, body, size, key, contentType)
}

// UploadImage загружает изображение; contentType, не начинающийся с image/, заменяется на octet-stream.
func (s *Service) UploadImage(ctx context.Context, body io.Reader, size int64, filename, contentType, folder string) (StoredObject, error) {
	if !strings.HasPrefix(contentType, "image/") {
		contentType = "application/octet-stream"
	}
	key, err := s.buildKey(filename, folder)
	if err != nil {
		return StoredObject{}, err
	}
	return s.put(ctx, body, size, key, contentType)
}

// UploadVideo uploads a video object while retaining its browser media type.
func (s *Service) UploadVideo(ctx context.Context, body io.Reader, size int64, filename, contentType, folder string) (StoredObject, error) {
	if !strings.HasPrefix(contentType, "video/") {
		contentType = "application/octet-stream"
	}
	key, err := s.buildKey(filename, folder)
	if err != nil {
		return StoredObject{}, err
	}
	return s.put(ctx, body, size, key, contentType)
}

// UploadSVGBytes загружает SVG-разметку как image/svg+xml.
func (s *Service) UploadSVGBytes(ctx context.Context, data []byte, folder string) (StoredObject, error) {
	uuid, err := newUUID()
	if err != nil {
		return StoredObject{}, err
	}
	key := strings.TrimRight(folder, "/") + "/" + uuid + ".svg"
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

// GetObject opens an object for streaming through an authenticated HTTP route.
func (s *Service) GetObject(ctx context.Context, key string) (ObjectBody, error) {
	result, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.cfg.Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return ObjectBody{}, err
	}
	return ObjectBody{
		Body:          result.Body,
		ContentType:   aws.ToString(result.ContentType),
		ContentLength: aws.ToInt64(result.ContentLength),
	}, nil
}

// ObjectSize returns the current S3 object size without downloading its body.
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
	select {
	case s.uploadSlots <- struct{}{}:
		defer func() { <-s.uploadSlots }()
	case <-ctx.Done():
		return StoredObject{}, ctx.Err()
	}
	temp, err := spoolUpload(body, size)
	if err != nil {
		return StoredObject{}, fmt.Errorf("stage object %q: %w", key, err)
	}
	tempName := temp.Name()
	defer func() {
		_ = temp.Close()
		_ = os.Remove(tempName)
	}()
	_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.cfg.Bucket),
		Key:           aws.String(key),
		Body:          temp,
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(size),
	})
	if err != nil {
		return StoredObject{}, err
	}
	return StoredObject{Key: key, URL: s.buildURL(key)}, nil
}

func spoolUpload(body io.Reader, size int64) (_ *os.File, err error) {
	if size < 0 {
		return nil, fmt.Errorf("negative size")
	}
	temp, err := os.CreateTemp("", "dndshare-upload-*")
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			_ = temp.Close()
			_ = os.Remove(temp.Name())
		}
	}()
	written, err := io.Copy(temp, io.LimitReader(body, size+1))
	if err != nil {
		return nil, err
	}
	if written != size {
		return nil, fmt.Errorf("size changed while reading: got %d, want %d", written, size)
	}
	if _, err := temp.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	return temp, nil
}

func (s *Service) buildKey(filename, folder string) (string, error) {
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
	uuid, err := newUUID()
	if err != nil {
		return "", err
	}
	return prefix + "/" + uuid + ext, nil
}

func (s *Service) buildURL(key string) string {
	base := s.cfg.PublicURL
	if base == "" {
		base = fmt.Sprintf("%s/%s", s.cfg.Endpoint, s.cfg.Bucket)
	}
	return strings.TrimRight(base, "/") + "/" + key
}

package storage

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"dndshare/internal/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func TestContentAddressedSystemMediaIsImmutable(t *testing.T) {
	svc := New(config.StorageConfig{Endpoint: "https://storage.example.test", Region: "ru-central1",
		Bucket: "test-bucket", AccessKey: "test-key", SecretKey: "test-secret"})
	opts := svc.client.Options()
	opts.HTTPClient = storageHTTPClientFunc(func(r *http.Request) (*http.Response, error) {
		want := ""
		if strings.Contains(r.URL.Path, "/system-item-media/") {
			want = "public, max-age=31536000, immutable"
		}
		if got := r.Header.Get("Cache-Control"); got != want {
			t.Errorf("%s: Cache-Control=%q, want %q", r.URL.Path, got, want)
		}
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header),
			Body: io.NopCloser(strings.NewReader(""))}, nil
	})
	svc.client = s3.New(opts)
	for _, key := range []string{"system-item-media/v1/static/test/hash.webp", "images/replaceable.webp"} {
		if _, err := svc.put(t.Context(), strings.NewReader("webp"), 4, key, "image/webp"); err != nil {
			t.Fatal(err)
		}
	}
}

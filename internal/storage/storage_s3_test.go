package storage

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"

	"dndshare/internal/config"
)

type storageHTTPClientFunc func(*http.Request) (*http.Response, error)

func (f storageHTTPClientFunc) Do(r *http.Request) (*http.Response, error) { return f(r) }

func TestS3CompatibleUploadDownloadAndPresign(t *testing.T) {
	const payload = "object payload"
	const key = "images/test.webp"
	svc := New(config.StorageConfig{
		Endpoint: "https://storage.example.test", Region: "ru-central1",
		Bucket: "test-bucket", AccessKey: "test-key", SecretKey: "test-secret",
	})
	var methods []string
	opts := svc.client.Options()
	opts.HTTPClient = storageHTTPClientFunc(func(r *http.Request) (*http.Response, error) {
		methods = append(methods, r.Method)
		if r.URL.Host != "storage.example.test" || r.URL.Path != "/test-bucket/"+key {
			t.Errorf("unexpected object URL: %s", r.URL)
		}
		if r.Header.Get("Authorization") == "" {
			t.Error("request must be signed")
		}
		for name := range r.Header {
			lower := strings.ToLower(name)
			if strings.Contains(lower, "checksum") || lower == "x-amz-trailer" {
				t.Errorf("unexpected optional checksum header: %s", name)
			}
		}
		responseBody := ""
		if r.Method == http.MethodPut {
			body, err := io.ReadAll(r.Body)
			if err != nil || string(body) != payload || r.ContentLength != int64(len(payload)) {
				t.Errorf("upload changed: body=%q length=%d err=%v", body, r.ContentLength, err)
			}
			if r.Header.Get("Content-Encoding") != "" || len(r.Trailer) != 0 {
				t.Error("upload must not use checksum streaming trailers")
			}
		} else if r.Method == http.MethodGet {
			responseBody = payload
		} else {
			t.Errorf("unexpected method: %s", r.Method)
		}
		return &http.Response{
			StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"image/webp"}},
			Body: io.NopCloser(strings.NewReader(responseBody)), ContentLength: int64(len(responseBody)),
		}, nil
	})
	svc.client = s3.New(opts)
	ctx := context.Background()
	if _, err := svc.put(ctx, strings.NewReader(payload), int64(len(payload)), key, "image/webp"); err != nil {
		t.Fatal(err)
	}
	object, err := svc.GetObject(ctx, key)
	if err != nil {
		t.Fatal(err)
	}
	defer object.Body.Close()
	body, err := io.ReadAll(object.Body)
	if err != nil || string(body) != payload || object.ContentType != "image/webp" {
		t.Fatalf("download changed: body=%q type=%q err=%v", body, object.ContentType, err)
	}
	signedURL, err := svc.PresignGet(ctx, key, 5*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(signedURL)
	if err != nil {
		t.Fatal(err)
	}
	if u.Host != "storage.example.test" || u.Path != "/test-bucket/"+key || u.Query().Get("X-Amz-Expires") != "300" || u.Query().Get("X-Amz-Signature") == "" {
		t.Fatalf("unexpected presigned URL: %s", signedURL)
	}
	for name := range u.Query() {
		if strings.Contains(strings.ToLower(name), "checksum") {
			t.Errorf("unexpected optional checksum query parameter: %s", name)
		}
	}
	if strings.Join(methods, ",") != "PUT,GET" {
		t.Fatalf("unexpected HTTP calls: %v", methods)
	}
}

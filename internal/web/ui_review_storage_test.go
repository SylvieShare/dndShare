package web

import (
	"bytes"
	"dndshare/internal/config"
	"dndshare/internal/storage"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// A local S3 HTTP boundary for UI tests. Production storage is never contacted.
func reviewStorage(t *testing.T) (func(string) *storage.Service, http.Handler) {
	t.Helper()
	type object struct {
		data        []byte
		contentType string
	}
	var mutex sync.Mutex
	objects := map[string]object{}
	s3 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := strings.TrimPrefix(r.URL.Path, "/native-review/")
		mutex.Lock()
		defer mutex.Unlock()
		switch r.Method {
		case http.MethodPut:
			data, err := io.ReadAll(io.LimitReader(r.Body, 31<<20))
			if err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			objects[key] = object{data, r.Header.Get("Content-Type")}
			w.Header().Set("ETag", `"native-review"`)
			w.WriteHeader(200)
		case http.MethodDelete:
			delete(objects, key)
			w.WriteHeader(204)
		case http.MethodGet:
			object, ok := objects[key]
			if !ok {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", object.contentType)
			_, _ = w.Write(object.data)
		default:
			w.WriteHeader(405)
		}
	}))
	t.Cleanup(s3.Close)
	public := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := strings.TrimPrefix(r.URL.Path, "/__test/media/")
		mutex.Lock()
		object, ok := objects[key]
		mutex.Unlock()
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", object.contentType)
		http.ServeContent(w, r, key, time.Time{}, bytes.NewReader(object.data))
	})
	return func(publicURL string) *storage.Service {
		return storage.New(config.StorageConfig{Endpoint: s3.URL, Region: "us-east-1", Bucket: "native-review", PublicURL: publicURL + "/__test/media", AccessKey: "local-test", SecretKey: "local-test"})
	}, public
}

func TestReviewStorageBoundary(t *testing.T) {
	factory, handler := reviewStorage(t)
	public := httptest.NewServer(handler)
	defer public.Close()
	service := factory(public.URL)
	data := []byte("local object bytes")
	stored, err := service.UploadImage(t.Context(), bytes.NewReader(data), int64(len(data)), "fixture.png", "image/png", "native-ui")
	if err != nil {
		t.Fatal(err)
	}
	response, err := http.Get(stored.URL)
	if err != nil {
		t.Fatal(err)
	}
	actual, err := io.ReadAll(response.Body)
	response.Body.Close()
	if err != nil || response.StatusCode != 200 || !bytes.Equal(data, actual) {
		t.Fatalf("local S3 boundary changed data: status=%d error=%v", response.StatusCode, err)
	}
	if err = service.DeleteObject(t.Context(), stored.Key); err != nil {
		t.Fatal(err)
	}
	response, err = http.Get(stored.URL)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != 404 {
		t.Fatalf("object remained after deletion: %d", response.StatusCode)
	}
}

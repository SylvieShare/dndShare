package web

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"dndshare/internal/config"
	"dndshare/internal/storage"
)

func TestCreatureArchiveS3CompletionAndReadback(t *testing.T) {
	data, spec := archiveFixture(t, nil)
	temporary := "creature-model-archive-uploads/c0000000-0000-4000-8000-000000000002.tar.gz"
	key := creatureArchiveObjectKey(spec)
	objects := map[string][]byte{temporary: data}
	var mu sync.Mutex
	copies, deletes := 0, 0
	s3 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		object := strings.TrimPrefix(r.URL.Path, "/test/")
		if r.URL.Query().Get("list-type") == "2" {
			fmt.Fprintf(w, `<ListBucketResult><Contents><Key>%s</Key><Size>%d</Size></Contents><NextContinuationToken>next-page</NextContinuationToken><IsTruncated>true</IsTruncated></ListBucketResult>`, key, len(data))
			return
		}
		switch r.Method {
		case "HEAD", "GET":
			body, ok := objects[object]
			if !ok {
				w.WriteHeader(404)
				return
			}
			w.Header().Set("Content-Length", fmt.Sprint(len(body)))
			if r.Method == "GET" {
				w.Write(body)
			}
		case "PUT":
			copies++
			objects[object] = bytes.Clone(objects[strings.TrimPrefix(r.Header.Get("X-Amz-Copy-Source"), "test/")])
			fmt.Fprint(w, `<CopyObjectResult><ETag>"copied"</ETag></CopyObjectResult>`)
		case "DELETE":
			deletes++
			delete(objects, object)
			w.WriteHeader(204)
		default:
			w.WriteHeader(405)
		}
	}))
	defer s3.Close()
	s := &Server{cfg: config.Config{MCPWriteEnabled: true}, s3: storage.New(config.StorageConfig{
		Endpoint: s3.URL, Bucket: "test", Region: "test", AccessKey: "test", SecretKey: "test",
	})}
	r := httptest.NewRequest("POST", "/mcp", nil)
	args := map[string]json.RawMessage{}
	for k, v := range map[string]any{"itemId": spec.ItemID, "modelId": spec.ModelID, "stage": spec.Stage, "sha256": spec.SHA256, "size": spec.Size, "uploadKey": temporary} {
		args[k], _ = json.Marshal(v)
	}
	for attempt := 0; attempt < 2; attempt++ {
		result, err := s.dispatchTool(r, "creature_model_archive_complete_upload", args)
		if err != nil {
			t.Fatal(err)
		}
		if result.(map[string]any)["key"] != key {
			t.Fatal("wrong immutable key", result)
		}
	}
	if copies != 1 || deletes != 1 || !bytes.Equal(objects[key], data) {
		t.Fatal("completion was not idempotent", copies, deletes)
	}
	result, err := s.dispatchTool(r, "creature_model_archive_get", args)
	if err != nil || !strings.Contains(result.(map[string]any)["downloadUrl"].(string), "X-Amz-Expires=900") {
		t.Fatal("signed download", result, err)
	}
	result, err = s.dispatchTool(r, "creature_model_archive_list", args)
	if err != nil || result.(map[string]any)["nextCursor"] != "next-page" {
		t.Fatal("paginated source index", result, err)
	}
	// A changed object must be revalidated even when its immutable key exists.
	objects[key] = bytes.Repeat([]byte{'x'}, len(data))
	if _, err := s.dispatchTool(r, "creature_model_archive_complete_upload", args); err == nil {
		t.Fatal("trusted corrupted existing archive")
	}
}

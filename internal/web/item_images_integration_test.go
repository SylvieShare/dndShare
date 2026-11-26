package web

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"

	"dndshare/internal/config"
	"dndshare/internal/storage"
)

func TestItemImageRoutesPostgres(t *testing.T) {
	f := newAuthHTTPFixture(t)
	const iconPath = "/api/items/100/icon"
	const coverPath = "/api/items/100/cover"
	png := append([]byte("\x89PNG\r\n\x1a\n"), []byte("icon fixture")...)
	jpeg := []byte("\xff\xd8\xffcover fixture")

	var mu sync.Mutex
	objects := make(map[string][]byte)
	fakeS3 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch r.Method {
		case http.MethodPut:
			body, err := io.ReadAll(r.Body)
			if err != nil {
				t.Error(err)
			}
			objects[r.URL.Path] = body
			w.WriteHeader(http.StatusOK)
		case http.MethodDelete:
			delete(objects, r.URL.Path)
			w.WriteHeader(http.StatusNoContent)
		default:
			t.Errorf("unexpected S3 request: %s", r.Method)
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))
	t.Cleanup(fakeS3.Close)
	assertObjects := func(expected ...[]byte) {
		t.Helper()
		mu.Lock()
		defer mu.Unlock()
		if len(objects) != len(expected) {
			t.Fatalf("S3 contains %d objects, want %d", len(objects), len(expected))
		}
		for _, want := range expected {
			found := false
			for _, data := range objects {
				found = found || bytes.Equal(data, want)
			}
			if !found {
				t.Fatalf("S3 is missing %q", want)
			}
		}
	}
	s3 := storage.New(config.StorageConfig{
		Endpoint: fakeS3.URL, Region: "test", Bucket: "test", KeyPrefix: "media",
		AccessKey: "test", SecretKey: "test",
	})
	server := httptest.NewServer(New(config.Config{SecureCookie: "false"}, f.store, s3).Handler())
	t.Cleanup(server.Close)
	f.url = server.URL
	exec := func(query string, args ...any) {
		t.Helper()
		if _, err := f.pool.Exec(t.Context(), query, args...); err != nil {
			t.Fatal(err)
		}
	}

	owner := authClient(t)
	user, _ := f.request(owner, "POST", "/api/user/registration", `{"login":"author","password":"test-author-password"}`, 200)
	exec("INSERT INTO dndshare.item_type(id,name,source_id,fields) VALUES(2,'Предметы',1,'[]')")
	exec("INSERT INTO dndshare.item(id,user_id,custom_source_id,name,type_id,data) VALUES(100,$1,(SELECT id FROM dndshare.custom_item_source WHERE user_id=$1 AND is_default),'Меч',2,'{}')", int64(user["id"].(float64)))
	other := authClient(t)
	f.request(other, "POST", "/api/user/registration", `{"login":"reader","password":"test-reader-password"}`, 200)

	upload := func(client *http.Client, path string, data []byte, status int) map[string]any {
		t.Helper()
		var body bytes.Buffer
		form := multipart.NewWriter(&body)
		part, err := form.CreateFormFile("file", "upload.img")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(data); err != nil {
			t.Fatal(err)
		}
		if err := form.Close(); err != nil {
			t.Fatal(err)
		}
		r, err := http.NewRequestWithContext(t.Context(), http.MethodPost, f.url+path+"-image", &body)
		if err != nil {
			t.Fatal(err)
		}
		r.Header.Set("Content-Type", form.FormDataContentType())
		res, err := client.Do(r)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		var result map[string]any
		if err := json.NewDecoder(res.Body).Decode(&result); err != nil {
			t.Fatal(err)
		}
		if res.StatusCode != status {
			t.Fatalf("%s: got %d, want %d: %v", path, res.StatusCode, status, result)
		}
		return result
	}

	upload(other, coverPath, jpeg, http.StatusUnauthorized)
	rejected := upload(owner, iconPath, jpeg, http.StatusBadRequest)
	if rejected["desc"] != "only PNG and WebP icons are allowed" {
		t.Fatal(rejected)
	}
	assertObjects()

	icon := upload(owner, iconPath, png, http.StatusOK)
	cover := upload(owner, coverPath, jpeg, http.StatusOK)
	for slot, result := range map[string]map[string]any{"icon": icon, "cover": cover} {
		url, _ := result[slot+"ImageUrl"].(string)
		if result[slot+"ImageId"] == nil || !strings.Contains(url, "media/") || len(result) != 2 {
			t.Fatalf("invalid %s response: %v", slot, result)
		}
	}
	assertObjects(png, jpeg)

	// Force the database write to fail after S3 has accepted the new cover.
	exec("ALTER TABLE dndshare.item ADD CONSTRAINT keep_original_cover CHECK (cover_image_id IS NULL OR cover_image_id = " + strconv.FormatInt(int64(cover["coverImageId"].(float64)), 10) + ")")
	upload(owner, coverPath, png, http.StatusInternalServerError)
	assertObjects(png, jpeg)

	f.request(other, "DELETE", coverPath, "", http.StatusUnauthorized)
	f.request(owner, "DELETE", coverPath, "", http.StatusNoContent)
	assertObjects(png)
	f.request(owner, "DELETE", iconPath, "", http.StatusNoContent)
	assertObjects()
}

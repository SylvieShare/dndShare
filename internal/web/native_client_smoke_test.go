package web

import (
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"sync/atomic"
	"testing"

	"dndshare/internal/config"
	"dndshare/internal/store"
)

// The opt-in profile drives a real Android APK against the HTTP API and a
// disposable PostgreSQL database. Its control routes exist only in this test.
func TestNativeClientSmokePostgres(t *testing.T) {
	if os.Getenv("DNDSHARE_NATIVE_SMOKE") != "1" {
		t.Skip("Android/API/PostgreSQL smoke: scripts/native/smoke.py")
	}
	f := newAuthHTTPFixture(t)
	user, _ := f.request(authClient(t), "POST", "/api/user/registration",
		`{"login":"native_tester","password":"Native-pass-42"}`, 200)
	userID := int64(user["id"].(float64))
	api := New(config.Config{SecureCookie: "false"}, f.store, nil).Handler()
	var offline atomic.Bool
	var images atomic.Int64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/__test/stats":
			writeJSON(w, 200, map[string]int64{"images": images.Load()})
		case "/__test/offline":
			offline.Store(r.URL.Query().Get("value") == "true")
			w.WriteHeader(204)
		case "/__test/change":
			if err := f.store.Update(r.Context(), 1, userID, true, "Native Flame Updated", nil,
				json.RawMessage(`{"description":"<p>Обновлённое описание.</p>"}`), store.ItemMetadataPatch{}); err != nil {
				serverError(w, err)
				return
			}
			if _, err := f.store.Delete(r.Context(), 2, userID, true); err != nil {
				serverError(w, err)
				return
			}
			w.WriteHeader(204)
		case "/__test/image.png":
			images.Add(1)
			if offline.Load() {
				w.WriteHeader(503)
				return
			}
			w.Header().Set("Content-Type", "image/png")
			w.Header().Set("Cache-Control", "public,max-age=86400")
			picture := image.NewRGBA(image.Rect(0, 0, 64, 64))
			for y := range 64 {
				for x := range 64 {
					picture.Set(x, y, color.RGBA{R: 124, G: 92, B: 226, A: 255})
				}
			}
			_ = png.Encode(w, picture)
		default:
			if offline.Load() {
				w.WriteHeader(503)
				return
			}
			api.ServeHTTP(w, r)
		}
	}))
	defer server.Close()
	androidURL := server.URL
	_, err := f.pool.Exec(t.Context(), `INSERT INTO dndshare.char_template(id,name) OVERRIDING SYSTEM VALUE VALUES(1,'DND5');
 INSERT INTO dndshare."char"(user_id,template_id,source_version_id,data)
 VALUES($1,1,1,'{"values":{"name":"Лира","lvl":{"level":7}}}');
 INSERT INTO dndshare.item_type(id,name,source_id,fields)
 VALUES(5,'Заклинания',1,'[{"key":"description","name":"Описание","type":"description"},{"key":"lvl","name":"Уровень","type":"int","filter":true,"filter_values":[0,1]}]');
 INSERT INTO dndshare.storage_image(id,url,type,mime_type) VALUES(1,$2,'ITEM_COVER','image/png');
 INSERT INTO dndshare.item(id,type_id,name,data,cover_image_id)
 SELECT id,5,CASE id WHEN 1 THEN 'Native Flame' WHEN 2 THEN 'Native Retired' ELSE 'Spell '||id END,
 '{"description":"<p>Это описание из локальной базы.</p>","lvl":1}',CASE WHEN id=1 THEN 1 END
 FROM generate_series(1,205) AS id;
 INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status)
 SELECT id,1,'native' FROM dndshare.item;`, userID, androidURL+"/__test/image.png")
	if err != nil {
		t.Fatal(err)
	}
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	command := exec.CommandContext(t.Context(), "python3", "scripts/native/smoke.py", "--url", server.URL)
	command.Dir = root
	command.Stdout = os.Stdout
	command.Stderr = os.Stderr
	if err := command.Run(); err != nil {
		t.Fatal("native/API/PostgreSQL smoke: ", err)
	}
}

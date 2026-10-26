package web

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"

	"dndshare/internal/config"
)

// TestUIReviewPostgres serves both real clients from one disposable database.
// These fixture/control routes are compiled only into the Go test binary.
func TestUIReviewPostgres(t *testing.T) {
	if os.Getenv("DNDSHARE_UI_REVIEW") != "1" {
		t.Skip("visual capture: python3 scripts/visual/compare.py")
	}
	f := newAuthHTTPFixture(t)
	directory := "testdata/ui-review"
	files := map[string][]byte{}
	hash := sha256.New()
	for _, name := range []string{"fixture.json", "seed.sql", "cover.svg", "emblem.svg"} {
		data, err := os.ReadFile(filepath.Join(directory, name))
		if err != nil {
			t.Fatal(err)
		}
		files[name] = data
		hash.Write([]byte(name + "\x00"))
		hash.Write(data)
	}
	var fixture map[string]any
	if err := json.Unmarshal(files["fixture.json"], &fixture); err != nil {
		t.Fatal(err)
	}
	fixture["dataFixtureHash"] = hex.EncodeToString(hash.Sum(nil))
	credentials, _ := json.Marshal(map[string]any{"login": fixture["login"], "password": fixture["password"]})
	f.request(authClient(t), "POST", "/api/user/registration", string(credentials), 200)
	api := New(config.Config{SecureCookie: "false"}, f.store, nil).Handler()
	var mutex sync.Mutex
	images := map[string]int{}
	requests := map[string]int{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mutex.Lock()
		requests[r.URL.Path]++
		mutex.Unlock()
		switch r.URL.Path {
		case "/__test/fixture":
			writeJSON(w, 200, fixture)
		case "/__test/stats":
			mutex.Lock()
			defer mutex.Unlock()
			writeJSON(w, 200, map[string]any{"images": images, "requests": requests})
		case "/__test/cover.svg", "/__test/emblem.svg":
			name := filepath.Base(r.URL.Path)
			mutex.Lock()
			images[name]++
			mutex.Unlock()
			w.Header().Set("Content-Type", "image/svg+xml")
			w.Header().Set("Cache-Control", "no-store")
			_, _ = w.Write(files[name])
		default:
			api.ServeHTTP(w, r)
		}
	}))
	t.Cleanup(server.Close)
	if _, err := f.pool.Exec(t.Context(), string(files["seed.sql"]), server.URL,
		fixture["recordName"], fixture["description"]); err != nil {
		t.Fatal(err)
	}
	// Check the served contract before starting either consumer.
	client := authClient(t)
	f.request(client, "POST", "/api/user/auth", string(credentials), 200)
	f.request(client, "PUT", "/api/account/game-context", `{"sourceId":1,"sourceVersionId":1}`, 200)
	items, _ := f.request(client, "GET", "/api/items/by-ids?ids=1", "", 200)
	item := items["items"].([]any)[0].(map[string]any)
	if item["name"] != fixture["recordName"] {
		t.Fatalf("review fixture mismatch: %+v", item)
	}
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	command := exec.CommandContext(t.Context(), "python3", "scripts/visual/capture.py", "--url", server.URL)
	command.Dir = root
	command.Stdout, command.Stderr = os.Stdout, os.Stderr
	if err := command.Run(); err != nil {
		t.Fatal("WEB/ANDROID capture: ", err)
	}
}

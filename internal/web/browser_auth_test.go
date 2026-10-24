package web

import (
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"dndshare/internal/config"
)

// This profile serves the built application and the real API against testdb.
// No API response is mocked in the browser.
func TestBrowserAuthPostgres(t *testing.T) {
	if os.Getenv("DNDSHARE_BROWSER_SMOKE") != "1" {
		t.Skip("full browser/API/PostgreSQL smoke: python3 scripts/test.py browser")
	}
	fixture := newAuthHTTPFixture(t)
	frontend, err := filepath.Abs("../../frontend")
	if err != nil {
		t.Fatal(err)
	}
	dist := filepath.Join(frontend, "target", "dist")
	if _, err := os.Stat(filepath.Join(dist, "index.html")); err != nil {
		t.Fatal("build frontend before browser smoke: ", err)
	}
	api := New(config.Config{SecureCookie: "false"}, fixture.store, nil).Handler()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isAPIPath(r.URL.Path) {
			api.ServeHTTP(w, r)
			return
		}
		file := filepath.Join(dist, filepath.Clean("/"+r.URL.Path))
		if info, err := os.Stat(file); err == nil && !info.IsDir() {
			http.ServeFile(w, r, file)
			return
		}
		http.ServeFile(w, r, filepath.Join(dist, "index.html"))
	}))
	t.Cleanup(server.Close)
	command := exec.CommandContext(t.Context(), "npx", "playwright", "test", "-c", "playwright.suite.config.js", "--project=fullstack")
	command.Dir = frontend
	output := filepath.Join(frontend, "target", "test-results", "fullstack")
	command.Env = append(os.Environ(), "DNDSHARE_SMOKE_URL="+server.URL,
		"DNDSHARE_BROWSER_OUTPUT="+filepath.Join(output, "artifacts"),
		"DNDSHARE_BROWSER_REPORT="+filepath.Join(frontend, "target", "test-reports", "fullstack.json"))
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("browser/API/PostgreSQL: %v\n%s", err, output)
	} else {
		t.Log(string(output))
	}
}

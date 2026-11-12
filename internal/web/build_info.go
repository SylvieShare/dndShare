package web

import (
	"encoding/json"
	"io"
	"io/fs"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dndshare/internal/assets"
	"dndshare/internal/clientrelease"
)

var BuildVersion = "dev"
var BuildNumber = "0"
var BuildAPIContract = "1"

func init() { registerRoutes((*Server).routesBuildInfo) }
func (s *Server) routesBuildInfo(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/build-info", s.handleBuildInfo)
	mux.HandleFunc("GET /api/frontend-updates/latest", s.handleFrontendLatest)
	mux.HandleFunc("GET /api/frontend-updates/{file}", s.handleFrontendBundle)
}
func currentAPIContract() int { value, _ := strconv.Atoi(BuildAPIContract); return value }
func (s *Server) handleBuildInfo(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	number, _ := strconv.ParseInt(BuildNumber, 10, 64)
	var frontend *clientrelease.Frontend
	if data, err := fs.ReadFile(assets.Dist(), "build-info.json"); err == nil {
		_ = json.Unmarshal(data, &frontend)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"backend":  map[string]any{"version": BuildVersion, "build": number, "commitSha": currentBuildCommit(), "apiContract": currentAPIContract()},
		"frontend": frontend,
	})
}
func (s *Server) handleFrontendLatest(w http.ResponseWriter, r *http.Request) {
	data, _, err := clientrelease.Latest()
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write(data)
}
func (s *Server) handleFrontendBundle(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("file")
	if !strings.HasSuffix(name, ".zip") {
		http.NotFound(w, r)
		return
	}
	digest := strings.TrimSuffix(name, ".zip")
	file, err := clientrelease.OpenBundle(digest)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer file.Close()
	reader, ok := file.(io.ReadSeeker)
	if !ok {
		http.Error(w, "invalid release", 500)
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("ETag", `"`+digest+`"`)
	http.ServeContent(w, r, name, time.Time{}, reader)
}
func publicBuildPath(path string) bool {
	return path == "/api/build-info" || strings.HasPrefix(path, "/api/frontend-updates/")
}
func (s *Server) clientContract(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		value := r.Header.Get("X-DnDShare-Client-Api")
		if isAPIPath(r.URL.Path) && !publicBuildPath(r.URL.Path) && value != "" && value != strconv.Itoa(currentAPIContract()) {
			writeJSON(w, http.StatusUpgradeRequired, map[string]any{"type": "CLIENT_UPDATE_REQUIRED", "desc": "Для работы с сервером обновите приложение или страницу."})
			return
		}
		next.ServeHTTP(w, r)
	})
}

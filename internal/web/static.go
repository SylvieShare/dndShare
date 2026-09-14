package web

import (
	"io/fs"
	"mime"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"

	"dndshare/internal/assets"
)

func spaHandler(assetCacheDir string) http.Handler {
	var retained fs.FS
	if assetCacheDir != "" {
		retained = os.DirFS(assetCacheDir)
	}
	return newSPAHandler(assets.Dist(), retained)
}

// Current HTML always comes from the binary. Only immutable /static/ assets may
// fall back to the append-only release archive; missing assets must remain 404.
func newSPAHandler(current, retained fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "index.html" {
			serveIndex(w, current)
			return
		}
		if name != "" && fileExists(current, name) {
			serveAsset(w, r, current, name)
			return
		}
		if strings.HasPrefix(name, "static/") && retained != nil && fileExists(retained, name) {
			serveAsset(w, r, retained, name)
			return
		}
		if name != "" && strings.Contains(path.Base(name), ".") {
			http.NotFound(w, r)
			return
		}
		serveIndex(w, current)
	})
}

func serveAsset(w http.ResponseWriter, r *http.Request, files fs.FS, name string) {
	if strings.HasPrefix(name, "static/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	}
	if ext := path.Ext(name); ext == ".js" || ext == ".css" {
		w.Header().Set("Vary", "Accept-Encoding")
		if acceptsGzip(r.Header.Get("Accept-Encoding")) && fileExists(files, name+".gz") {
			w.Header().Set("Content-Encoding", "gzip")
			w.Header().Set("Content-Type", mime.TypeByExtension(ext))
			copy := r.Clone(r.Context())
			copy.URL.Path = "/" + name + ".gz"
			r = copy
		}
	}
	http.FileServer(http.FS(files)).ServeHTTP(w, r)
}

func acceptsGzip(header string) bool {
	for _, entry := range strings.Split(header, ",") {
		parts := strings.Split(strings.TrimSpace(entry), ";")
		if !strings.EqualFold(strings.TrimSpace(parts[0]), "gzip") {
			continue
		}
		quality := 1.0
		for _, parameter := range parts[1:] {
			pair := strings.SplitN(strings.TrimSpace(parameter), "=", 2)
			if len(pair) == 2 && strings.EqualFold(pair[0], "q") {
				value, err := strconv.ParseFloat(pair[1], 64)
				if err != nil {
					return false
				}
				quality = value
			}
		}
		return quality > 0
	}
	return false
}

func fileExists(fsys fs.FS, name string) bool {
	f, err := fsys.Open(name)
	if err != nil {
		return false
	}
	defer f.Close()
	st, err := f.Stat()
	return err == nil && !st.IsDir()
}

func serveIndex(w http.ResponseWriter, fsys fs.FS) {
	data, err := fs.ReadFile(fsys, "index.html")
	if err != nil {
		apiError(w, http.StatusInternalServerError, "ServerException", "index.html not found")
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

package web

import (
	"io/fs"
	"net/http"
	"path"
	"strings"

	"dndshare/internal/assets"
)

// spaHandler отдаёт вшитый фронт (порт SpaResourceResolver). Есть файл — отдаём его;
// путь с расширением, но файла нет — 404 (недостающий ассет); иначе — index.html
// (SPA-fallback на любой глубине роутинга). /api/ и /mcp сюда не попадают (их разбирает mux).
func spaHandler() http.Handler {
	fsys := assets.Dist()
	fileServer := http.FileServer(http.FS(fsys))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name != "" && fileExists(fsys, name) {
			fileServer.ServeHTTP(w, r)
			return
		}
		last := name
		if i := strings.LastIndex(name, "/"); i >= 0 {
			last = name[i+1:]
		}
		if strings.Contains(last, ".") {
			http.NotFound(w, r)
			return
		}
		serveIndex(w, fsys)
	})
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
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

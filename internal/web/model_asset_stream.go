package web

import (
	"io"
	"log"
	"net/http"
	"strconv"

	"dndshare/internal/battlemap"
)

func (s *Server) streamModelAsset(w http.ResponseWriter, r *http.Request, asset battlemap.ModelAsset, visibility string) {
	sha := r.URL.Query().Get("sha")
	if sha != "" && sha != asset.SHA256 {
		notFound(w, "")
		return
	}
	etag := `"` + asset.SHA256 + `"`
	if sha != "" {
		w.Header().Set("Cache-Control", visibility+", max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "no-cache")
	}
	w.Header().Set("ETag", etag)
	if r.Header.Get("If-None-Match") == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	body, err := s.s3.GetObject(r.Context(), asset.Key)
	if err != nil {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Del("ETag")
		serverError(w, err)
		return
	}
	defer body.Body.Close()
	w.Header().Set("Content-Type", asset.MimeType)
	w.Header().Set("Content-Length", strconv.FormatInt(body.ContentLength, 10))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if _, err := io.Copy(w, body.Body); err != nil {
		log.Printf("stream model asset %s: %v", asset.Key, err)
	}
}

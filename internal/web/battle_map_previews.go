package web

import (
	"bytes"
	"errors"
	"image"
	"io"
	"log"
	"net/http"
	"strconv"

	"dndshare/internal/store"
	_ "golang.org/x/image/webp"
)

const maxMapPreviewBytes = 1 << 20

func init() { registerRoutes((*Server).routesMapPreviews) }
func (s *Server) routesMapPreviews(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/maps/{mapId}/preview-context", s.mapAdminOnly(s.handleMapPreviewContext))
	mux.HandleFunc("POST /api/maps/{mapId}/preview", s.mapAdminOnly(s.handleSaveMapPreview))
	mux.HandleFunc("GET /api/maps/{mapId}/preview", s.mapAdminOnly(s.handleMapPreview))
}
func (s *Server) handleMapPreviewContext(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	_, data, err := s.loadMapPreviewContext(r, uid)
	if err != nil {
		mapError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, data)
}
func validMapPreview(data []byte) bool {
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	return err == nil && format == "webp" && config.Width >= 64 && config.Height >= 64 && config.Width <= 1024 && config.Height <= 1024
}
func (s *Server) handleSaveMapPreview(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	m, data, err := s.loadMapPreviewContext(r, uid)
	if err != nil {
		mapError(w, err)
		return
	}
	if r.URL.Query().Get("signature") != data.Signature {
		conflict(w, "Карта или модели изменились; обновите превью")
		return
	}
	if r.Header.Get("Content-Type") != "image/webp" {
		badRequest(w, "Превью должно быть WebP")
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxMapPreviewBytes))
	if err != nil || !validMapPreview(body) {
		badRequest(w, "Некорректное WebP-превью, максимум 1 МБ и 1024×1024")
		return
	}
	// Duplicate generators reuse an already published image.
	existing, err := s.store.GetMapPreview(r.Context(), m.ID, m.System)
	if err == nil && existing.Signature == data.Signature {
		writeJSON(w, http.StatusOK, map[string]string{"previewUrl": mapPreviewURL(m.ID, data.Signature)})
		return
	}
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		serverError(w, err)
		return
	}
	object, err := s.s3.UploadImage(r.Context(), bytes.NewReader(body), int64(len(body)), "preview.webp", "image/webp", "map-previews")
	if err != nil {
		serverError(w, err)
		return
	}
	current, latest, err := s.loadMapPreviewContext(r, uid)
	if err != nil || latest.Signature != data.Signature || current.Revision != m.Revision {
		s.removeMapPreviewObject(r.Context(), object.Key)
		if err != nil {
			mapError(w, err)
		} else {
			conflict(w, "Карта или модели изменились; обновите превью")
		}
		return
	}
	old, err := s.store.SaveMapPreview(r.Context(), uid, m, store.MapPreview{Signature: data.Signature, ObjectKey: object.Key, FileSize: int64(len(body))})
	if err != nil {
		s.removeMapPreviewObject(r.Context(), object.Key)
		mapError(w, err)
		return
	}
	s.removeMapPreviewObject(r.Context(), old)
	writeJSON(w, http.StatusOK, map[string]string{"previewUrl": mapPreviewURL(m.ID, data.Signature)})
}
func (s *Server) handleMapPreview(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	m, err := s.findMap(r, uid, r.PathValue("mapId"))
	if err != nil {
		mapError(w, err)
		return
	}
	p, err := s.store.GetMapPreview(r.Context(), m.ID, m.System)
	if err != nil {
		mapError(w, err)
		return
	}
	if p.Signature != r.URL.Query().Get("signature") {
		notFound(w, "")
		return
	}
	object, err := s.s3.GetObject(r.Context(), p.ObjectKey)
	if err != nil {
		serverError(w, err)
		return
	}
	defer object.Body.Close()
	w.Header().Set("Content-Type", "image/webp")
	w.Header().Set("Content-Length", strconv.FormatInt(object.ContentLength, 10))
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	w.Header().Set("ETag", `"`+p.Signature+`"`)
	if _, err = io.Copy(w, object.Body); err != nil {
		log.Printf("stream map preview: %v", err)
	}
}

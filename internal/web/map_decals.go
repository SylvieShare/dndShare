package web

import (
	"bytes"
	"dndshare/internal/battlemap"
	"io"
	"net/http"
	"strings"
)

func init() { registerRoutes((*Server).routesMapDecals) }
func (s *Server) routesMapDecals(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/maps/decals", s.handleMapDecals)
	mux.HandleFunc("POST /api/maps/decals", s.handleUploadMapDecal)
	mux.HandleFunc("GET /api/map-decal-images/{decalId}", s.handleMapDecalImage)
}
func (s *Server) handleMapDecals(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	images, err := s.store.ListMapDecalImages(r.Context(), uid)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, images)
}

const maxDecalImageBytes = 8 << 20

func (s *Server) handleUploadMapDecal(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxDecalImageBytes+1<<20)
	if err := r.ParseMultipartForm(1 << 20); err != nil {
		badRequest(w, "Не удалось прочитать изображение (до 8 МБ)")
		return
	}
	defer r.MultipartForm.RemoveAll()
	file, header, err := r.FormFile("file")
	if err != nil {
		badRequest(w, "Выберите изображение")
		return
	}
	defer file.Close()
	name, category := strings.TrimSpace(r.FormValue("name")), r.FormValue("category")
	if len([]rune(name)) < 1 || len([]rune(name)) > 100 || !battlemap.DecalCategory(category) || header.Size < 1 || header.Size > maxDecalImageBytes {
		badRequest(w, "Некорректные параметры декали")
		return
	}
	data, err := io.ReadAll(io.LimitReader(file, maxDecalImageBytes+1))
	if err != nil {
		serverError(w, err)
		return
	}
	mime := http.DetectContentType(data)
	width, height, err := rasterImageDimensions(data, mime)
	if err != nil || width < 1 || height < 1 || width > 2048 || height > 2048 {
		badRequest(w, "Декаль: PNG или WebP, до 2048×2048 пикселей")
		return
	}
	stored, err := s.s3.UploadImage(r.Context(), bytes.NewReader(data), int64(len(data)), header.Filename, mime, "map-decals")
	if err != nil {
		serverError(w, err)
		return
	}
	image, err := s.store.CreateMapDecalImage(r.Context(), uid, stored.Key, stored.URL, name, mime, category, int64(len(data)), width, height)
	if err != nil {
		s.s3.DeleteObject(r.Context(), stored.Key)
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, image)
}

// Immutable image URLs are shareable with a copied/published map and the public
// table display. The unguessable UUID is also its public asset identifier.
func (s *Server) handleMapDecalImage(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("decalId")
	if !isUUID(id) {
		notFound(w, "")
		return
	}
	key, mime, err := s.store.GetMapDecalImageFile(r.Context(), id)
	if err != nil {
		mapError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("ETag", `"`+id+`"`)
	if r.Header.Get("If-None-Match") == `"`+id+`"` {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	object, err := s.s3.GetObject(r.Context(), key)
	if err != nil {
		serverError(w, err)
		return
	}
	defer object.Body.Close()
	w.Header().Set("Content-Type", mime)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	io.Copy(w, object.Body)
}

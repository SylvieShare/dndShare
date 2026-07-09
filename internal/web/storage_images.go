package web

import (
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesStorageImages) }

// maxImageBytes — предел размера загружаемого изображения (защита от заливки гигабайтов в S3).
const maxImageBytes int64 = 15 << 20

func (s *Server) routesStorageImages(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/storage/images", s.handleUploadImage)
}

// imageUploadResponse — порт StorageImageController.ImageUploadResponse.
type imageUploadResponse struct {
	UploadID int64  `json:"upload_id"`
	URL      string `json:"url"`
	Key      string `json:"key"`
}

// handleUploadImage загружает изображение в S3 и регистрирует его в storage_image
// (порт StorageImageController.uploadImage).
func (s *Server) handleUploadImage(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxImageBytes+1<<20)
	file, header, err := r.FormFile("file")
	if err != nil {
		badRequest(w, "file is required")
		return
	}
	defer file.Close()
	if header.Size > maxImageBytes {
		badRequest(w, "file too large")
		return
	}
	if ct := header.Header.Get("Content-Type"); ct != "" && !strings.HasPrefix(ct, "image/") {
		badRequest(w, "not an image")
		return
	}

	stored, err := s.s3.UploadImage(r.Context(), file, header.Size, header.Filename, header.Header.Get("Content-Type"), "")
	if err != nil {
		serverError(w, err)
		return
	}
	id, err := s.store.SaveStorageImage(r.Context(), uid, stored.Key, stored.URL, "image")
	if err != nil {
		serverError(w, err)
		return
	}
	if raw := r.FormValue("old_upload_id"); raw != "" {
		if oldID, perr := strconv.ParseInt(raw, 10, 64); perr == nil {
			s.deleteOldImage(r, uid, oldID)
		}
	}
	writeJSON(w, http.StatusOK, imageUploadResponse{UploadID: id, URL: stored.URL, Key: stored.Key})
}

// deleteOldImage удаляет прежнее изображение пользователя (порт private deleteOldImage).
func (s *Server) deleteOldImage(r *http.Request, userID, uploadID int64) {
	old, err := s.store.GetActiveUserStorageImage(r.Context(), uploadID, userID)
	if err != nil {
		if !errors.Is(err, store.ErrNotFound) {
			log.Printf("delete old image %d: lookup: %v", uploadID, err)
		}
		return
	}
	if err := s.s3.DeleteObject(r.Context(), old.Key); err != nil {
		log.Printf("delete old image %d: s3 %q: %v", uploadID, old.Key, err)
	}
	if err := s.store.MarkStorageImageDeletedByUser(r.Context(), uploadID, userID); err != nil {
		log.Printf("delete old image %d: mark deleted: %v", uploadID, err)
	}
}

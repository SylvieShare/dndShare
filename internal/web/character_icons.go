package web

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"

	"dndshare/internal/store"
)

const maxCharacterIconBytes int64 = 5 << 20
const maxCharacterIconPixels = 256

func init() { registerRoutes((*Server).routesCharacterIcons) }

func (s *Server) routesCharacterIcons(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/char/{uuid}/icon-image", s.handleUploadCharacterIconImage)
	mux.HandleFunc("DELETE /api/char/{uuid}/icon-image", s.handleClearCharacterIconImage)
}

func (s *Server) handleUploadCharacterIconImage(w http.ResponseWriter, r *http.Request) {
	uid, character, ok := s.loadCharWritable(w, r)
	if !ok {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxCharacterIconBytes+1<<20)
	file, header, err := r.FormFile("file")
	if err != nil {
		badRequest(w, "file is required")
		return
	}
	defer file.Close()
	if header.Size <= 0 || header.Size > maxCharacterIconBytes {
		badRequest(w, "Иконка должна быть не больше 5 МБ")
		return
	}

	data, err := io.ReadAll(file)
	if err != nil {
		serverError(w, err)
		return
	}
	contentType := http.DetectContentType(data)
	if contentType != "image/png" && contentType != "image/webp" {
		badRequest(w, "Поддерживаются только PNG и WebP")
		return
	}
	if err := validateCharacterIconDimensions(data, contentType); err != nil {
		badRequest(w, err.Error())
		return
	}
	stored, err := s.s3.UploadImage(r.Context(), bytes.NewReader(data), int64(len(data)), header.Filename, contentType, "character-icons")
	if err != nil {
		serverError(w, err)
		return
	}

	imageID, replaced, err := s.store.SetCharacterIconImage(
		r.Context(), character.ID, uid, stored.Key, stored.URL,
		safeUploadFileName(header.Filename), contentType, int64(len(data)),
	)
	if err != nil {
		if deleteErr := s.s3.DeleteObject(r.Context(), stored.Key); deleteErr != nil {
			log.Printf("delete unattached character icon %q: %v", stored.Key, deleteErr)
		}
		if errors.Is(err, store.ErrNotFound) {
			unauthorized(w)
			return
		}
		serverError(w, err)
		return
	}
	s.cleanupItemStorageImage(r.Context(), replaced)
	if sessionID, attached, lookupErr := s.store.SessionIDForCharacter(r.Context(), character.ID); lookupErr != nil {
		log.Printf("lookup session for character icon %d: %v", character.ID, lookupErr)
	} else if attached {
		s.publishSessionParticipants(sessionID)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"iconImageId":  imageID,
		"iconImageUrl": stored.URL,
	})
}

func (s *Server) handleClearCharacterIconImage(w http.ResponseWriter, r *http.Request) {
	uid, character, ok := s.loadCharWritable(w, r)
	if !ok {
		return
	}

	replaced, err := s.store.ClearCharacterIconImage(r.Context(), character.ID, uid)
	if errors.Is(err, store.ErrNotFound) {
		unauthorized(w)
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	s.cleanupItemStorageImage(r.Context(), replaced)
	if sessionID, attached, lookupErr := s.store.SessionIDForCharacter(r.Context(), character.ID); lookupErr != nil {
		log.Printf("lookup session for cleared character icon %d: %v", character.ID, lookupErr)
	} else if attached {
		s.publishSessionParticipants(sessionID)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"iconImageId":  nil,
		"iconImageUrl": nil,
	})
}

func validateCharacterIconDimensions(data []byte, contentType string) error {
	width, height, err := rasterImageDimensions(data, contentType)
	if err != nil {
		return errors.New("Не удалось определить разрешение иконки")
	}
	if width < 1 || height < 1 || width > maxCharacterIconPixels || height > maxCharacterIconPixels {
		return fmt.Errorf("Иконка должна быть не больше %d×%d пикселей", maxCharacterIconPixels, maxCharacterIconPixels)
	}
	return nil
}

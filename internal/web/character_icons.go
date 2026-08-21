package web

import (
	"bytes"
	"errors"
	"io"
	"log"
	"net/http"

	"dndshare/internal/store"
)

const maxCharacterIconBytes int64 = 5 << 20

func init() { registerRoutes((*Server).routesCharacterIcons) }

func (s *Server) routesCharacterIcons(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/char/{uuid}/icon-image", s.handleUploadCharacterIconImage)
}

func (s *Server) handleUploadCharacterIconImage(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	character, ok := s.loadChar(w, r)
	if !ok {
		return
	}
	if character.UserID != uid {
		unauthorized(w)
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
		badRequest(w, "file must be between 1 byte and 5 MB")
		return
	}

	prefix := make([]byte, 512)
	n, readErr := file.Read(prefix)
	if readErr != nil && !errors.Is(readErr, io.EOF) {
		serverError(w, readErr)
		return
	}
	contentType := http.DetectContentType(prefix[:n])
	if contentType != "image/png" && contentType != "image/webp" {
		badRequest(w, "only PNG and WebP icons are allowed")
		return
	}
	body := io.MultiReader(bytes.NewReader(prefix[:n]), file)
	stored, err := s.s3.UploadImage(r.Context(), body, header.Size, header.Filename, contentType, "character-icons")
	if err != nil {
		serverError(w, err)
		return
	}

	imageID, replaced, err := s.store.SetCharacterIconImage(
		r.Context(), character.ID, uid, stored.Key, stored.URL,
		safeUploadFileName(header.Filename), contentType, header.Size,
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

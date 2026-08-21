package web

import (
	"bytes"
	"encoding/binary"
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

func validateCharacterIconDimensions(data []byte, contentType string) error {
	width, height, err := characterIconDimensions(data, contentType)
	if err != nil {
		return errors.New("Не удалось определить разрешение иконки")
	}
	if width < 1 || height < 1 || width > maxCharacterIconPixels || height > maxCharacterIconPixels {
		return fmt.Errorf("Иконка должна быть не больше %d×%d пикселей", maxCharacterIconPixels, maxCharacterIconPixels)
	}
	return nil
}

func characterIconDimensions(data []byte, contentType string) (int, int, error) {
	switch contentType {
	case "image/png":
		if len(data) < 24 || !bytes.Equal(data[:8], []byte("\x89PNG\r\n\x1a\n")) {
			return 0, 0, errors.New("invalid PNG header")
		}
		return int(binary.BigEndian.Uint32(data[16:20])), int(binary.BigEndian.Uint32(data[20:24])), nil
	case "image/webp":
		if len(data) < 25 || !bytes.Equal(data[:4], []byte("RIFF")) || !bytes.Equal(data[8:12], []byte("WEBP")) {
			return 0, 0, errors.New("invalid WebP header")
		}
		switch string(data[12:16]) {
		case "VP8X":
			if len(data) < 30 {
				return 0, 0, errors.New("short VP8X header")
			}
			width := 1 + int(data[24]) + (int(data[25]) << 8) + (int(data[26]) << 16)
			height := 1 + int(data[27]) + (int(data[28]) << 8) + (int(data[29]) << 16)
			return width, height, nil
		case "VP8L":
			if data[20] != 0x2f {
				return 0, 0, errors.New("invalid VP8L signature")
			}
			width := 1 + int(data[21]) + (int(data[22]&0x3f) << 8)
			height := 1 + int(data[22]>>6) + (int(data[23]) << 2) + (int(data[24]&0x0f) << 10)
			return width, height, nil
		case "VP8 ":
			if len(data) < 30 || !bytes.Equal(data[23:26], []byte{0x9d, 0x01, 0x2a}) {
				return 0, 0, errors.New("invalid VP8 frame header")
			}
			width := int(binary.LittleEndian.Uint16(data[26:28]) & 0x3fff)
			height := int(binary.LittleEndian.Uint16(data[28:30]) & 0x3fff)
			return width, height, nil
		default:
			return 0, 0, errors.New("unsupported WebP encoding")
		}
	default:
		return 0, 0, errors.New("unsupported image type")
	}
}

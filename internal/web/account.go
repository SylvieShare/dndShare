package web

import (
	"net/http"
	"strings"
	"sync"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesAccount) }

func (s *Server) routesAccount(mux *http.ServeMux) {
	mux.HandleFunc("PUT /api/account/password", s.handleChangeAccountPassword)
	mux.HandleFunc("GET /api/account/storage", s.handleGetAccountStorage)
}

type accountPasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

func validateAccountPasswordRequest(w http.ResponseWriter, req accountPasswordRequest) bool {
	if req.CurrentPassword == "" {
		badRequest(w, "Введите текущий пароль")
		return false
	}
	if len([]rune(req.NewPassword)) < 4 || len([]rune(req.NewPassword)) > 256 {
		badRequest(w, "Новый пароль должен содержать от 4 до 256 символов")
		return false
	}
	if req.CurrentPassword == req.NewPassword {
		badRequest(w, "Новый пароль должен отличаться от текущего")
		return false
	}
	return true
}

func (s *Server) handleChangeAccountPassword(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	var req accountPasswordRequest
	if decodeJSON(r, &req) != nil || !validateAccountPasswordRequest(w, req) {
		return
	}
	user, err := s.store.FindUserByID(r.Context(), userID)
	if err != nil {
		serverError(w, err)
		return
	}
	if !verifyPassword(req.CurrentPassword, user.Password) {
		badRequest(w, "Текущий пароль указан неверно")
		return
	}
	hash, err := hashPassword(req.NewPassword)
	if err != nil {
		serverError(w, err)
		return
	}
	if err := s.store.UpdateUserPassword(r.Context(), userID, hash); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

type accountStorageBreakdown struct {
	Kind  string `json:"kind"`
	Label string `json:"label"`
	Bytes int64  `json:"bytes"`
	Count int    `json:"count"`
}

type accountStorageResponse struct {
	UsedBytes        int64                      `json:"usedBytes"`
	FileCount        int                        `json:"fileCount"`
	UnknownFileCount int                        `json:"unknownFileCount"`
	Breakdown        []accountStorageBreakdown  `json:"breakdown"`
	Files            []store.AccountStorageFile `json:"files"`
}

func (s *Server) hydrateAccountStorageSizes(r *http.Request, userID int64, files []store.AccountStorageFile) {
	var wait sync.WaitGroup
	jobs := make(chan int)
	for range 6 {
		wait.Add(1)
		go func() {
			defer wait.Done()
			for index := range jobs {
				size, err := s.s3.ObjectSize(r.Context(), *files[index].ObjectKey)
				if err != nil || size < 0 {
					continue
				}
				if err := s.store.UpdateStorageImageFileSize(r.Context(), userID, files[index].ID, size); err == nil {
					files[index].FileSize = &size
				}
			}
		}()
	}
	for index := range files {
		if files[index].Source != "asset" || files[index].FileSize != nil || files[index].ObjectKey == nil || strings.TrimSpace(*files[index].ObjectKey) == "" {
			continue
		}
		jobs <- index
	}
	close(jobs)
	wait.Wait()
}

func accountStorageSummary(files []store.AccountStorageFile) accountStorageResponse {
	labels := map[string]string{"image": "Изображения", "video": "Видео", "music": "Музыка"}
	order := []string{"image", "video", "music"}
	byKind := make(map[string]*accountStorageBreakdown, len(order))
	for _, kind := range order {
		byKind[kind] = &accountStorageBreakdown{Kind: kind, Label: labels[kind]}
	}
	result := accountStorageResponse{Breakdown: []accountStorageBreakdown{}, Files: files, FileCount: len(files)}
	for _, file := range files {
		entry := byKind[file.Kind]
		if entry == nil {
			entry = &accountStorageBreakdown{Kind: file.Kind, Label: "Другое"}
			byKind[file.Kind] = entry
			order = append(order, file.Kind)
		}
		entry.Count++
		if file.FileSize == nil {
			result.UnknownFileCount++
			continue
		}
		entry.Bytes += *file.FileSize
		result.UsedBytes += *file.FileSize
	}
	for _, kind := range order {
		if entry := byKind[kind]; entry != nil && entry.Count > 0 {
			result.Breakdown = append(result.Breakdown, *entry)
		}
	}
	return result
}

func (s *Server) handleGetAccountStorage(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	files, err := s.store.ListAccountStorageFiles(r.Context(), userID)
	if err != nil {
		serverError(w, err)
		return
	}
	s.hydrateAccountStorageSizes(r, userID, files)
	writeJSON(w, http.StatusOK, accountStorageSummary(files))
}

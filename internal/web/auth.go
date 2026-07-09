package web

import (
	"errors"
	"net/http"
	"time"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesAuth) }

func (s *Server) routesAuth(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/user/auth", s.handleAuth)
	mux.HandleFunc("GET /api/user/checkAuth", s.handleCheckAuth)
	mux.HandleFunc("GET /api/user/logout", s.handleLogout)
	mux.HandleFunc("POST /api/user/registration", s.handleRegistration)
	mux.HandleFunc("GET /ping", func(w http.ResponseWriter, r *http.Request) {})
}

// userBase — публичная инфа о пользователе (порт UserController.UserBase).
type userBase struct {
	ID    int64    `json:"id"`
	Login string   `json:"login"`
	Roles []string `json:"roles"`
}

// checkAuthResponse — порт UserController.CheckAuthResponse (NON_NULL: user опускается, если null).
type checkAuthResponse struct {
	Auth bool      `json:"auth"`
	User *userBase `json:"user,omitempty"`
}

func (s *Server) handleAuth(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Login    string `json:"login"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	user, err := s.store.FindUserByLogin(r.Context(), req.Login)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeJSON(w, http.StatusOK, checkAuthResponse{Auth: false})
			return
		}
		serverError(w, err)
		return
	}
	if !verifyPassword(req.Password, user.Password) {
		writeJSON(w, http.StatusOK, checkAuthResponse{Auth: false})
		return
	}
	if err := s.establishSession(w, r, user.ID); err != nil {
		serverError(w, err)
		return
	}
	roles, err := s.store.RolesByUser(r.Context(), user.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, checkAuthResponse{
		Auth: true,
		User: &userBase{ID: user.ID, Login: user.Login, Roles: nonNil(roles)},
	})
}

func (s *Server) handleCheckAuth(w http.ResponseWriter, r *http.Request) {
	uid, ok := optionalUser(r)
	if !ok {
		writeJSON(w, http.StatusOK, checkAuthResponse{Auth: false})
		return
	}
	user, err := s.store.FindUserByID(r.Context(), uid)
	if err != nil {
		writeJSON(w, http.StatusOK, checkAuthResponse{Auth: false})
		return
	}
	roles, err := s.store.RolesByUser(r.Context(), uid)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, checkAuthResponse{
		Auth: true,
		User: &userBase{ID: user.ID, Login: user.Login, Roles: nonNil(roles)},
	})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	uid, ok := optionalUser(r)
	if !ok {
		unauthorized(w)
		return
	}
	if c, err := r.Cookie(cookieSessionUUID); err == nil {
		_ = s.store.DeleteSession(r.Context(), uid, c.Value)
	}
	s.clearSessionCookies(w, r)
	writeJSON(w, http.StatusOK, nil)
}

func (s *Server) handleRegistration(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Login    string `json:"login"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	exists, err := s.store.ExistsByLogin(r.Context(), req.Login)
	if err != nil {
		serverError(w, err)
		return
	}
	if exists {
		conflict(w, "User exist")
		return
	}
	hash, err := hashPassword(req.Password)
	if err != nil {
		serverError(w, err)
		return
	}
	user, err := s.store.CreateUser(r.Context(), req.Login, hash)
	if err != nil {
		serverError(w, err)
		return
	}
	if err := s.establishSession(w, r, user.ID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":        user.ID,
		"login":     user.Login,
		"password":  user.Password,
		"createdAt": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) establishSession(w http.ResponseWriter, r *http.Request, userID int64) error {
	token := newUUID()
	if err := s.store.CreateSession(r.Context(), userID, token); err != nil {
		return err
	}
	s.setSessionCookies(w, r, userID, token)
	return nil
}

// nonNil заменяет nil-срез на пустой, чтобы JSON был [], а не null (roles всегда сериализуется).
func nonNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}

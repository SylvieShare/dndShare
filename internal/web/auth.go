package web

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesAuth) }

func (s *Server) routesAuth(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/user/auth", s.handleAuth)
	mux.HandleFunc("GET /api/user/checkAuth", s.handleCheckAuth)
	mux.HandleFunc("POST /api/user/logout", s.handleLogout)
	mux.HandleFunc("GET /api/user/logout", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Allow", http.MethodPost)
		w.WriteHeader(http.StatusMethodNotAllowed)
	})
	mux.HandleFunc("POST /api/user/registration", s.handleRegistration)
	mux.HandleFunc("GET /ping", func(w http.ResponseWriter, r *http.Request) {})
}

// userBase — публичная инфа о пользователе (порт UserController.UserBase).
type userBase struct {
	ID            int64                 `json:"id"`
	Login         string                `json:"login"`
	Roles         []string              `json:"roles"`
	GameContext   store.UserGameContext `json:"gameContext"`
	HasCharacters bool                  `json:"hasCharacters"`
}

// checkAuthResponse — порт UserController.CheckAuthResponse (NON_NULL: user опускается, если null).
type checkAuthResponse struct {
	Auth bool      `json:"auth"`
	User *userBase `json:"user,omitempty"`
}

func (s *Server) buildUserBase(ctx context.Context, user store.User) (*userBase, error) {
	roles, err := s.store.RolesByUser(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	gameContext, err := s.store.GetUserGameContext(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	hasCharacters, err := s.store.HasCharacters(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	return &userBase{
		ID:            user.ID,
		Login:         user.Login,
		Roles:         nonNil(roles),
		GameContext:   gameContext,
		HasCharacters: hasCharacters,
	}, nil
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
	req.Login = strings.TrimSpace(req.Login)
	if req.Login == "" || len([]rune(req.Login)) > 128 || req.Password == "" || len([]rune(req.Password)) > 256 {
		writeJSON(w, http.StatusOK, checkAuthResponse{Auth: false})
		return
	}
	loginKey := strings.ToLower(strings.TrimSpace(req.Login))
	if ok, retryAfter := s.authLimiter.allow("login:"+s.clientIP(r)+":"+loginKey, 10, 5*time.Minute, time.Now()); !ok {
		tooManyRequests(w, retryAfter)
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
	s.authLimiter.reset("login:" + s.clientIP(r) + ":" + loginKey)
	if err := s.establishSession(w, r, user.ID); err != nil {
		serverError(w, err)
		return
	}
	publicUser, err := s.buildUserBase(r.Context(), user)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, checkAuthResponse{
		Auth: true,
		User: publicUser,
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
	publicUser, err := s.buildUserBase(r.Context(), user)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, checkAuthResponse{
		Auth: true,
		User: publicUser,
	})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	uid, ok := optionalUser(r)
	if ok {
		if c, err := r.Cookie(cookieSessionUUID); err == nil {
			_ = s.store.DeleteSession(r.Context(), uid, c.Value)
		}
	}
	s.clearSessionCookies(w, r)
	writeJSON(w, http.StatusOK, nil)
}

func (s *Server) handleRegistration(w http.ResponseWriter, r *http.Request) {
	if ok, retryAfter := s.authLimiter.allow("registration:"+s.clientIP(r), 10, 15*time.Minute, time.Now()); !ok {
		tooManyRequests(w, retryAfter)
		return
	}
	var req struct {
		Login    string `json:"login"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	req.Login = strings.TrimSpace(req.Login)
	if loginLength := len([]rune(req.Login)); loginLength < 3 || loginLength > 64 {
		badRequest(w, "Логин должен содержать от 3 до 64 символов")
		return
	}
	if passwordLength := len([]rune(req.Password)); passwordLength < 4 || passwordLength > 256 {
		badRequest(w, "Пароль должен содержать от 4 до 256 символов")
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
		// Гонка check-then-act: параллельная регистрация того же логина упирается в
		// users_login_uindex — отдаём 409, а не 500.
		if store.IsUniqueViolation(err) {
			conflict(w, "User exist")
			return
		}
		serverError(w, err)
		return
	}
	if err := s.establishSession(w, r, user.ID); err != nil {
		serverError(w, err)
		return
	}
	// Хэш пароля в ответе не отдаём (утечка без нужды; фронт его не использует).
	writeJSON(w, http.StatusOK, map[string]any{
		"id":        user.ID,
		"login":     user.Login,
		"createdAt": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) establishSession(w http.ResponseWriter, r *http.Request, userID int64) error {
	token, err := newUUID()
	if err != nil {
		return err
	}
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

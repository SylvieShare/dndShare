package web

import (
	"context"
	"crypto/rand"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
)

type ctxKey int

const userIDKey ctxKey = 0

// Имена cookie — те же, что у прежней версии (иначе фронт разлогинится).
const (
	cookieSessionID   = "sylvieshare-session-id"
	cookieSessionUUID = "sylvieshare-session-uuid"
)

// Роли (dndshare.role.name).
const (
	RoleAdmin                  = "ADMIN"
	RoleHandbookAdmin          = "HANDBOOK_ADMIN"
	RoleErrorReportAutoApprove = "ERROR_REPORT_AUTO_APPROVE"
	RoleErrorReportReviewer    = "ERROR_REPORT_REVIEWER"
)

// recoverer ловит панику, логирует её в dndshare.logs и отдаёт 500 (аналог Advice).
func (s *Server) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			v := recover()
			if v == nil {
				return
			}
			// http.ErrAbortHandler — санкционированный stdlib способ прервать ответ; не логируем
			// как панику и пробрасываем дальше.
			if v == http.ErrAbortHandler {
				panic(v)
			}
			msg := fmt.Sprintf("%v", v)
			log.Printf("panic: %s %s: %v", r.Method, r.URL.Path, v)
			// Контекст запроса мог быть уже отменён (клиент отключился) — пишем лог без отмены.
			s.store.LogError(context.WithoutCancel(r.Context()), r.URL.Path, "panic", msg, msg)
			apiError(w, http.StatusInternalServerError, "RuntimeException", msg)
		}()
		next.ServeHTTP(w, r)
	})
}

// cors — для локальной разработки (vite :5173) с cookie-сессией. На проде same-origin.
func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == s.cfg.DevOrigin {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Credentials", "true")
			h.Set("Vary", "Origin")
			if r.Method == http.MethodOptions {
				h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				h.Set("Access-Control-Allow-Headers", "*")
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// session кладёт userID в контекст, если пара cookie валидна. Никого не блокирует —
// авторизацию проверяют сами хендлеры (mustUser / requireRole).
func (s *Server) session(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Статике и SPA-фолбэку личность не нужна — не ходим в БД на каждый JS/CSS/картинку.
		if isAPIPath(r.URL.Path) {
			if uid, ok := s.resolveUser(r); ok {
				r = r.WithContext(context.WithValue(r.Context(), userIDKey, uid))
			}
		}
		next.ServeHTTP(w, r)
	})
}

// resolveUser разбирает cookie и проверяет сессию в БД.
func (s *Server) resolveUser(r *http.Request) (int64, bool) {
	idCookie, err := r.Cookie(cookieSessionID)
	if err != nil {
		return 0, false
	}
	uuidCookie, err := r.Cookie(cookieSessionUUID)
	if err != nil {
		return 0, false
	}
	uid, err := strconv.ParseInt(idCookie.Value, 10, 64)
	if err != nil {
		return 0, false
	}
	ok, err := s.store.CheckSession(r.Context(), uid, uuidCookie.Value)
	if err != nil {
		log.Printf("check session: %v", err)
		return 0, false
	}
	if !ok {
		return 0, false
	}
	return uid, true
}

// mustUser — id авторизованного пользователя либо 401 (аналог @UserParam).
func mustUser(w http.ResponseWriter, r *http.Request) (int64, bool) {
	uid, ok := r.Context().Value(userIDKey).(int64)
	if !ok || uid == 0 {
		unauthorized(w)
		return 0, false
	}
	return uid, true
}

// optionalUser — id пользователя или (0,false), без записи ответа (аналог @UserParamOptional).
func optionalUser(r *http.Request) (int64, bool) {
	uid, ok := r.Context().Value(userIDKey).(int64)
	if !ok || uid == 0 {
		return 0, false
	}
	return uid, true
}

// requireRole — пользователь авторизован и имеет ВСЕ перечисленные роли, иначе 401
// (как @UserNeedRole: отсутствие роли даёт NoneAuthException).
func (s *Server) requireRole(w http.ResponseWriter, r *http.Request, roles ...string) (int64, bool) {
	uid, ok := mustUser(w, r)
	if !ok {
		return 0, false
	}
	have, err := s.store.RolesByUser(r.Context(), uid)
	if err != nil {
		serverError(w, err)
		return 0, false
	}
	set := map[string]bool{}
	for _, rr := range have {
		set[rr] = true
	}
	for _, need := range roles {
		if !set[need] {
			unauthorized(w)
			return 0, false
		}
	}
	return uid, true
}

// requireAnyRole authorizes a user that has at least one of the supplied roles.
func (s *Server) requireAnyRole(w http.ResponseWriter, r *http.Request, roles ...string) (int64, bool) {
	uid, ok := mustUser(w, r)
	if !ok {
		return 0, false
	}
	have, err := s.store.RolesByUser(r.Context(), uid)
	if err != nil {
		serverError(w, err)
		return 0, false
	}
	for _, current := range have {
		for _, need := range roles {
			if current == need {
				return uid, true
			}
		}
	}
	unauthorized(w)
	return 0, false
}

func (s *Server) setSessionCookies(w http.ResponseWriter, r *http.Request, userID int64, session string) {
	secure := s.secure(r)
	// HttpOnly: фронт не читает document.cookie, поэтому куки недоступны из JS (защита от
	// кражи сессии через XSS). SameSite=Lax — базовая защита от CSRF при same-origin.
	http.SetCookie(w, &http.Cookie{Name: cookieSessionID, Value: strconv.FormatInt(userID, 10), Path: "/", Secure: secure, HttpOnly: true, SameSite: http.SameSiteLaxMode})
	http.SetCookie(w, &http.Cookie{Name: cookieSessionUUID, Value: session, Path: "/", Secure: secure, HttpOnly: true, SameSite: http.SameSiteLaxMode})
}

func (s *Server) clearSessionCookies(w http.ResponseWriter, r *http.Request) {
	secure := s.secure(r)
	http.SetCookie(w, &http.Cookie{Name: cookieSessionID, Value: "", Path: "/", Secure: secure, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	http.SetCookie(w, &http.Cookie{Name: cookieSessionUUID, Value: "", Path: "/", Secure: secure, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: -1})
}

// secure решает, ставить ли Secure на cookie (режим auto/true/false).
func (s *Server) secure(r *http.Request) bool {
	switch s.cfg.SecureCookie {
	case "true":
		return true
	case "false":
		return false
	default:
		if r.TLS != nil {
			return true
		}
		return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
	}
}

// newUUID генерирует случайный UUIDv4 в каноничном строковом виде.
func newUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

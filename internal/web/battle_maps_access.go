package web

import "net/http"

// Personal maps and the rendering catalogue require a signed-in user.
// Map and session ownership is checked by the handlers.
func (s *Server) mapUserOnly(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := mustUser(w, r); ok {
			next(w, r)
		}
	}
}

// Editing the shared model catalogue remains an administrator action.
func (s *Server) mapAdminOnly(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.requireRole(w, r, RoleAdmin); ok {
			next(w, r)
		}
	}
}

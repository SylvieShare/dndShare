package web

import (
	"net/http"
	"slices"

	"dndshare/internal/store"
)

// Maps are in administrator preview. Session ownership is still checked by
// the handlers; ADMIN does not grant access to another master's private maps.
func (s *Server) mapAdminOnly(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if _, ok := s.requireRole(w, r, RoleAdmin); ok {
			next(w, r)
		}
	}
}

// A table monitor can remain signed out when its session belongs to an admin.
func (s *Server) publicMapSession(w http.ResponseWriter, r *http.Request) (store.GameSession, bool) {
	session, ok := s.publicDisplaySession(w, r)
	if !ok {
		return session, false
	}
	roles, err := s.store.RolesByUser(r.Context(), session.OwnerUserID)
	if err != nil {
		serverError(w, err)
		return session, false
	}
	if !slices.Contains(roles, RoleAdmin) {
		notFound(w, "Скоро будет")
		return session, false
	}
	return session, true
}

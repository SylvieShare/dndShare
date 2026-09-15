package web

import (
	"encoding/json"
	"net/http"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesSessionInventory) }
func (s *Server) routesSessionInventory(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/sessions/{uuid}/inventory", s.handleSessionInventory)
	mux.HandleFunc("POST /api/sessions/{uuid}/inventory", s.handleAddSessionInventory)
	mux.HandleFunc("DELETE /api/sessions/{uuid}/inventory/{entryId}", s.handleDeleteSessionInventory)
	mux.HandleFunc("POST /api/sessions/{uuid}/inventory/{entryId}/transfer", s.handleSendSessionInventory)
}
func (s *Server) inventorySession(w http.ResponseWriter, r *http.Request) (int64, store.GameSession, bool) {
	uid, ok := mustUser(w, r)
	if !ok {
		return 0, store.GameSession{}, false
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return 0, session, false
	}
	if session.OwnerUserID != uid {
		forbidden(w)
		return 0, session, false
	}
	return uid, session, true
}
func (s *Server) handleSessionInventory(w http.ResponseWriter, r *http.Request) {
	uid, session, ok := s.inventorySession(w, r)
	if !ok {
		return
	}
	entries, transfers, err := s.store.SessionInventory(r.Context(), session.ID, uid)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries, "transfers": transfers})
}
func (s *Server) handleAddSessionInventory(w http.ResponseWriter, r *http.Request) {
	uid, session, ok := s.inventorySession(w, r)
	if !ok {
		return
	}
	var req struct {
		Source         string          `json:"source"`
		Name           string          `json:"name"`
		Entry          json.RawMessage `json:"entry"`
		ClientActionID string          `json:"clientActionId"`
	}
	if decodeJSON(r, &req) != nil || !isUUID(req.ClientActionID) {
		badRequest(w, "Некорректный предмет")
		return
	}
	if err := s.store.AddSessionInventory(r.Context(), session.ID, uid, req.Source, req.Name, req.ClientActionID, req.Entry); err != nil {
		itemTransferError(w, err)
		return
	}
	s.publishSessionJournal(session.ID)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) handleDeleteSessionInventory(w http.ResponseWriter, r *http.Request) {
	uid, session, ok := s.inventorySession(w, r)
	if !ok {
		return
	}
	id := r.PathValue("entryId")
	if !isUUID(id) {
		badRequest(w, "Некорректный предмет")
		return
	}
	if err := s.store.DeleteSessionInventory(r.Context(), session.ID, uid, id); err != nil {
		itemTransferError(w, err)
		return
	}
	s.publishSessionJournal(session.ID)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (s *Server) handleSendSessionInventory(w http.ResponseWriter, r *http.Request) {
	uid, session, ok := s.inventorySession(w, r)
	if !ok {
		return
	}
	var req struct {
		RecipientCharUUID string `json:"recipientCharUuid"`
		ClientActionID    string `json:"clientActionId"`
	}
	id := r.PathValue("entryId")
	if decodeJSON(r, &req) != nil || !isUUID(id) || !isUUID(req.RecipientCharUUID) || !isUUID(req.ClientActionID) {
		badRequest(w, "Выберите получателя")
		return
	}
	recipient, err := s.store.GetCharacter(r.Context(), req.RecipientCharUUID)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	offer, err := s.store.SendSessionInventory(r.Context(), session.ID, uid, recipient.ID, id, req.ClientActionID)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	s.publishTransferChange(offer)
	writeJSON(w, http.StatusOK, map[string]any{"transfer": offer})
}

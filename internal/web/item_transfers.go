package web

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesItemTransfers) }
func (s *Server) routesItemTransfers(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/sessions/{uuid}/events/{eventId}/approve", s.handleApproveTransferEvent)
	mux.HandleFunc("GET /api/char/{uuid}/item-transfers", s.handlePendingItemTransfers)
	mux.HandleFunc("POST /api/char/{uuid}/item-transfers", s.handleCreateItemTransfer)
	mux.HandleFunc("POST /api/char/{uuid}/item-transfers/{transferId}/resolve", s.handleResolveItemTransfer)
}

func (s *Server) transferOwner(w http.ResponseWriter, r *http.Request) (int64, store.CharacterItem, bool) {
	uid, ok := mustUser(w, r)
	if !ok {
		return 0, store.CharacterItem{}, false
	}
	c, ok := s.loadChar(w, r)
	if !ok {
		return 0, c, false
	}
	if c.UserID != uid {
		forbidden(w)
		return 0, c, false
	}
	return uid, c, true
}

func (s *Server) handlePendingItemTransfers(w http.ResponseWriter, r *http.Request) {
	_, c, ok := s.transferOwner(w, r)
	if !ok {
		return
	}
	transfers, err := s.store.PendingItemTransfers(r.Context(), c.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"transfers": transfers})
}

type itemTransferRequest struct {
	OptionKey         string `json:"optionKey"`
	Purpose           string `json:"purpose"`
	SessionUUID       string `json:"sessionUuid"`
	RecipientCharUUID string `json:"recipientCharUuid"`
	Source            string `json:"source"`
	EntryUID          string `json:"entryUid"`
	Version           *int64 `json:"version"`
	ClientActionID    string `json:"clientActionId"`
}

func validItemTransferRequest(req itemTransferRequest) bool {
	return (req.Source != "spells" || req.Purpose == "use") && len(req.OptionKey) <= 100 && (req.Purpose == "" || req.Purpose == "transfer" || (req.Purpose == "use" && (req.Source == "potions" || req.Source == "spells"))) && isUUID(req.SessionUUID) && (isUUID(req.RecipientCharUUID) || req.RecipientCharUUID == "dm") && isUUID(req.ClientActionID) &&
		req.Version != nil && *req.Version >= 0 && len(req.EntryUID) > 0 && len(req.EntryUID) <= 200 &&
		(req.Source == "items" || req.Source == "weapon" || req.Source == "potions" || req.Source == "spells")
}

func (s *Server) handleCreateItemTransfer(w http.ResponseWriter, r *http.Request) {
	uid, c, ok := s.transferOwner(w, r)
	if !ok {
		return
	}
	var req itemTransferRequest
	if decodeJSON(r, &req) != nil || !validItemTransferRequest(req) {
		badRequest(w, "Некорректная передача предмета")
		return
	}
	session, err := s.store.GetGameSessionByUUID(r.Context(), req.SessionUUID)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	var recipient store.CharacterItem
	if req.RecipientCharUUID != "dm" {
		recipient, err = s.store.GetCharacter(r.Context(), req.RecipientCharUUID)
		if err != nil {
			itemTransferError(w, err)
			return
		}
		if c.ID == recipient.ID {
			badRequest(w, "Выберите другого персонажа")
			return
		}
	}
	var transfer store.ItemTransfer
	if req.Source == "spells" {
		transfer, err = s.store.CreateSpellApplication(r.Context(), uid, session.ID, c.ID, recipient.ID, *req.Version, req.EntryUID, req.ClientActionID, req.OptionKey)
	} else if req.Purpose == "use" {
		transfer, err = s.store.CreatePotionUseOption(r.Context(), uid, session.ID, c.ID, recipient.ID, *req.Version, req.EntryUID, req.ClientActionID, req.OptionKey)
	} else {
		transfer, err = s.store.CreateItemTransfer(r.Context(), uid, session.ID, c.ID, recipient.ID, *req.Version, req.Source, req.EntryUID, req.ClientActionID)
	}
	if err != nil {
		itemTransferError(w, err)
		return
	}
	s.publishTransferChange(transfer)
	writeJSON(w, http.StatusOK, map[string]any{"transfer": transfer})
}

func (s *Server) handleResolveItemTransfer(w http.ResponseWriter, r *http.Request) {
	uid, c, ok := s.transferOwner(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("transferId"), 10, 64)
	var req struct {
		Decision string `json:"decision"`
	}
	if err != nil || id <= 0 || decodeJSON(r, &req) != nil || (req.Decision != "accept" && req.Decision != "reject") {
		badRequest(w, "Выберите принятие или отказ")
		return
	}
	transfer, err := s.store.ResolveItemTransfer(r.Context(), uid, c.ID, id, req.Decision == "accept")
	if err != nil {
		itemTransferError(w, err)
		return
	}
	s.publishTransferChange(transfer)
	writeJSON(w, http.StatusOK, map[string]any{"transfer": transfer})
}

func (s *Server) publishTransferChange(t store.ItemTransfer) {
	var target store.ApplicationTarget
	_ = json.Unmarshal(t.ResolvedTarget, &target)
	s.sessionLive.publish(t.SessionID, sessionLiveUpdate{Journal: true, CharacterIDs: []int64{t.SenderCharID, t.RecipientCharID, target.CharID}})
	if target.Kind == "npc" {
		s.displayEvents.publish(t.SessionID)
	}
}

func itemTransferError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrApplication):
		badRequest(w, err.Error())
	case errors.Is(err, store.ErrNotFound):
		notFound(w, "Передача или участник сессии не найдены")
	case errors.Is(err, store.ErrItemTransferConflict), errors.Is(err, store.ErrCharacterVersion):
		conflict(w, err.Error())
	default:
		serverError(w, err)
	}
}

func (s *Server) handleApproveTransferEvent(w http.ResponseWriter, r *http.Request) {
	uid, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != uid {
		forbidden(w)
		return
	}
	id, err := strconv.ParseInt(r.PathValue("eventId"), 10, 64)
	if err != nil || id <= 0 {
		badRequest(w, "Некорректное событие")
		return
	}
	transfer, err := s.store.ApproveSessionTransfer(r.Context(), uid, session.ID, id)
	if err != nil {
		itemTransferError(w, err)
		return
	}
	s.publishTransferChange(transfer)
	writeJSON(w, http.StatusOK, map[string]any{"transfer": transfer})
}

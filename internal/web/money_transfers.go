package web

import (
	"errors"
	"net/http"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesMoneyTransfers) }
func (s *Server) routesMoneyTransfers(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/char/{uuid}/money-transfers", s.handleMoneyTransfer)
}

type moneyTransferRequest struct {
	SessionUUID       string `json:"sessionUuid"`
	RecipientCharUUID string `json:"recipientCharUuid"`
	ClientActionID    string `json:"clientActionId"`
	CurrencyID        int64  `json:"currencyId"`
	Amount            int64  `json:"amount"`
	Version           *int64 `json:"version"`
}

func validMoneyTransferRequest(req moneyTransferRequest) bool {
	return isUUID(req.SessionUUID) && isUUID(req.RecipientCharUUID) && isUUID(req.ClientActionID) &&
		req.CurrencyID > 0 && req.Amount > 0 && req.Amount <= store.MaxMoneyAmount && req.Version != nil && *req.Version >= 0
}

func (s *Server) handleMoneyTransfer(w http.ResponseWriter, r *http.Request) {
	uid, sender, ok := s.transferOwner(w, r)
	if !ok {
		return
	}
	var req moneyTransferRequest
	if decodeJSON(r, &req) != nil || !validMoneyTransferRequest(req) {
		badRequest(w, "Выберите валюту, положительную целую сумму и получателя")
		return
	}
	session, err := s.store.GetGameSessionByUUID(r.Context(), req.SessionUUID)
	if err != nil {
		moneyTransferError(w, err)
		return
	}
	recipient, err := s.store.GetCharacter(r.Context(), req.RecipientCharUUID)
	if err != nil {
		moneyTransferError(w, err)
		return
	}
	event, err := s.store.TransferCharacterMoney(r.Context(), uid, session.ID, sender.ID, recipient.ID, *req.Version, req.CurrencyID, req.Amount, req.ClientActionID)
	if err != nil {
		moneyTransferError(w, err)
		return
	}
	s.sessionLive.publish(session.ID, sessionLiveUpdate{Journal: true, CharacterIDs: []int64{sender.ID, recipient.ID}})
	writeJSON(w, http.StatusOK, sessionEventResponse{Event: event})
}

func moneyTransferError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrMoneyTransfer):
		badRequest(w, err.Error())
	case errors.Is(err, store.ErrCharacterVersion), errors.Is(err, store.ErrMoneyTransferConflict):
		conflict(w, err.Error())
	case errors.Is(err, store.ErrNotFound):
		notFound(w, "Участник сессии не найден")
	default:
		serverError(w, err)
	}
}

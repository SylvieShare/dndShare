package web

import (
	"net/http"
	"strings"

	"dndshare/internal/store"
)

type questMutationRequest struct {
	Name         string                        `json:"name"`
	Status       string                        `json:"status"`
	Goal         *string                       `json:"goal"`
	Condition    *string                       `json:"condition"`
	Reward       *string                       `json:"reward"`
	Consequences *string                       `json:"consequences"`
	Notes        *string                       `json:"notes"`
	Relations    []store.SessionEntityRelation `json:"relations"`
}

func questMutation(w http.ResponseWriter, req questMutationRequest) (store.SessionQuestMutation, bool) {
	name := strings.TrimSpace(req.Name)
	if name == "" || len([]rune(name)) > 160 {
		badRequest(w, "Укажите название задания")
		return store.SessionQuestMutation{}, false
	}
	if req.Status == "" {
		req.Status = "planned"
	}
	if req.Status != "planned" && req.Status != "active" && req.Status != "completed" && req.Status != "failed" {
		badRequest(w, "Некорректный статус задания")
		return store.SessionQuestMutation{}, false
	}
	if !validEntityRelations(req.Relations) {
		badRequest(w, "Слишком много связей")
		return store.SessionQuestMutation{}, false
	}
	return store.SessionQuestMutation{
		Name: name, Status: req.Status,
		Goal: cleanText(req.Goal, 5000), Condition: cleanText(req.Condition, 5000),
		Reward: cleanText(req.Reward, 5000), Consequences: cleanText(req.Consequences, 5000),
		Notes: cleanText(req.Notes, 5000), Relations: cleanEntityRelations(req.Relations),
	}, true
}

func (s *Server) handleCreateSessionQuest(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	var req questMutationRequest
	if decodeJSON(r, &req) != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	mutation, ok := questMutation(w, req)
	if !ok {
		return
	}
	id, err := s.store.CreateSessionQuest(r.Context(), session.ID, mutation)
	if err != nil {
		writeSessionWorldStoreError(w, err)
		return
	}
	s.writeSessionWorldMutation(w, r, session.ID, id)
}

func (s *Server) handleUpdateSessionQuest(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	id, ok := sessionWorldPathID(w, r, "questId")
	if !ok {
		return
	}
	quest, err := s.store.GetSessionQuest(r.Context(), id)
	if err != nil || quest.SessionID != session.ID {
		writeSessionWorldStoreError(w, store.ErrNotFound)
		return
	}
	var req questMutationRequest
	if decodeJSON(r, &req) != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	mutation, ok := questMutation(w, req)
	if !ok {
		return
	}
	if err := s.store.UpdateSessionQuest(r.Context(), session.ID, id, mutation); err != nil {
		writeSessionWorldStoreError(w, err)
		return
	}
	s.writeSessionWorldMutation(w, r, session.ID, id)
}

func (s *Server) handleDeleteSessionQuest(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	id, ok := sessionWorldPathID(w, r, "questId")
	if !ok {
		return
	}
	if err := s.store.DeleteSessionQuest(r.Context(), session.ID, id); err != nil {
		writeSessionWorldStoreError(w, err)
		return
	}
	s.writeSessionWorldMutation(w, r, session.ID, 0)
}

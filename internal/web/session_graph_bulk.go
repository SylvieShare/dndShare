package web

import (
	"errors"
	"math"
	"net/http"

	"dndshare/internal/store"
)

const maxBulkGraphNodes = 200

type graphPositionsRequest struct {
	Level     string                    `json:"level"`
	Positions []store.GraphNodePosition `json:"positions"`
}

type graphDeleteRequest struct {
	Level string  `json:"level"`
	IDs   []int64 `json:"ids"`
}

type graphStatusRequest struct {
	Level  string  `json:"level"`
	IDs    []int64 `json:"ids"`
	Status string  `json:"status"`
}

func init() { registerRoutes((*Server).routesSessionGraphBulk) }

func (s *Server) routesSessionGraphBulk(mux *http.ServeMux) {
	mux.HandleFunc("PATCH /api/sessions/{uuid}/graph-nodes/positions", s.handleMoveGraphNodes)
	mux.HandleFunc("PATCH /api/sessions/{uuid}/graph-nodes/status", s.handleUpdateGraphNodeStatus)
	mux.HandleFunc("POST /api/sessions/{uuid}/graph-nodes/delete", s.handleDeleteGraphNodes)
}

func validGraphStatus(level, status string) bool {
	return level == "chapters" && chapterStatuses[status]
}

func validGraphLevel(level string) bool {
	return level == "chapters" || level == "scenes" || level == "blocks"
}

func validGraphNodeIDs(ids []int64) bool {
	if len(ids) == 0 || len(ids) > maxBulkGraphNodes {
		return false
	}
	seen := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return false
		}
		if _, exists := seen[id]; exists {
			return false
		}
		seen[id] = struct{}{}
	}
	return true
}

func validGraphPositions(positions []store.GraphNodePosition) bool {
	ids := make([]int64, len(positions))
	for index, position := range positions {
		ids[index] = position.ID
		if math.IsNaN(position.X) || math.IsInf(position.X, 0) ||
			math.IsNaN(position.Y) || math.IsInf(position.Y, 0) {
			return false
		}
	}
	return validGraphNodeIDs(ids)
}

func (s *Server) handleMoveGraphNodes(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	var req graphPositionsRequest
	if err := decodeJSON(r, &req); err != nil || !validGraphLevel(req.Level) || !validGraphPositions(req.Positions) {
		badRequest(w, "Некорректные позиции карточек")
		return
	}
	if err := s.store.UpdateGraphNodePositions(r.Context(), session.ID, req.Level, req.Positions); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			badRequest(w, "Карточки не принадлежат сессии")
			return
		}
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleDeleteGraphNodes(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	var req graphDeleteRequest
	if err := decodeJSON(r, &req); err != nil || !validGraphLevel(req.Level) || !validGraphNodeIDs(req.IDs) {
		badRequest(w, "Некорректный список карточек")
		return
	}
	deleted, err := s.store.DeleteGraphNodes(r.Context(), session.ID, req.Level, req.IDs)
	if errors.Is(err, store.ErrNotFound) {
		badRequest(w, "Карточки не принадлежат сессии")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	if !deleted {
		conflict(w, "Сначала удалите или перенесите сценарии выбранных глав")
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleUpdateGraphNodeStatus(w http.ResponseWriter, r *http.Request) {
	_, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	var req graphStatusRequest
	if err := decodeJSON(r, &req); err != nil || !validGraphNodeIDs(req.IDs) || !validGraphStatus(req.Level, req.Status) {
		badRequest(w, "Некорректный статус выбранных карточек")
		return
	}
	if err := s.store.UpdateGraphNodeStatus(r.Context(), session.ID, req.Level, req.IDs, req.Status); err != nil {
		if errors.Is(err, store.ErrNotFound) {
			badRequest(w, "Карточки не принадлежат сессии")
			return
		}
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

package web

import (
	"errors"
	"net/http"
	"strconv"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesSessionSceneGraph) }

func (s *Server) routesSessionSceneGraph(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/sessions/{uuid}/chapters/{chapterId}/scene-graph", s.handleGetSceneGraph)
	mux.HandleFunc("PATCH /api/sessions/{uuid}/scenes/{sceneId}/position", s.handleMoveScenePosition)
	mux.HandleFunc("POST /api/sessions/{uuid}/scene-edges", s.handleCreateSceneEdge)
	mux.HandleFunc("DELETE /api/sessions/{uuid}/scene-edges/{edgeId}", s.handleDeleteSceneEdge)
	mux.HandleFunc("GET /api/sessions/{uuid}/scenes/{sceneId}/block-graph", s.handleGetSceneBlockGraph)
	mux.HandleFunc("POST /api/sessions/{uuid}/block-edges", s.handleCreateSceneBlockEdge)
	mux.HandleFunc("DELETE /api/sessions/{uuid}/block-edges/{edgeId}", s.handleDeleteSceneBlockEdge)
}

func sceneGraphPathInt64(w http.ResponseWriter, r *http.Request, key string) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue(key), 10, 64)
	if err != nil {
		badRequest(w, "bad "+key)
		return 0, false
	}
	return id, true
}

func (s *Server) requireSceneAccess(w http.ResponseWriter, r *http.Request) (store.SceneSession, bool) {
	userID, ok := mustUser(w, r)
	if !ok {
		return store.SceneSession{}, false
	}
	sess, ok := s.requireSceneSession(w, r)
	if !ok {
		return store.SceneSession{}, false
	}
	allowed, err := s.store.UserCanAccessSession(r.Context(), sess.ID, userID)
	if err != nil {
		serverError(w, err)
		return store.SceneSession{}, false
	}
	if !allowed {
		unauthorized(w)
		return store.SceneSession{}, false
	}
	return sess, true
}

func (s *Server) handleGetSceneGraph(w http.ResponseWriter, r *http.Request) {
	sess, ok := s.requireSceneAccess(w, r)
	if !ok {
		return
	}
	chapterID, ok := sceneGraphPathInt64(w, r, "chapterId")
	if !ok || !s.requireChapterInSession(w, r, chapterID, sess.ID) {
		return
	}
	scenes, err := s.store.GetScenesByChapter(r.Context(), chapterID)
	if err != nil {
		serverError(w, err)
		return
	}
	edges, err := s.store.GetSceneEdgesByChapter(r.Context(), chapterID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"scenes": nonNil(scenes), "edges": nonNil(edges)})
}

func (s *Server) handleMoveScenePosition(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	sess, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	sceneID, ok := sceneGraphPathInt64(w, r, "sceneId")
	if !ok {
		return
	}
	if _, ok := s.requireSceneInSession(w, r, sceneID, sess.ID); !ok {
		return
	}
	var req struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
	}
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "bad body")
		return
	}
	if err := s.store.UpdateScenePosition(r.Context(), sceneID, req.X, req.Y); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleCreateSceneEdge(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	sess, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	var req struct {
		ChapterID   int64   `json:"chapterId"`
		FromSceneID int64   `json:"fromSceneId"`
		ToSceneID   int64   `json:"toSceneId"`
		Label       *string `json:"label"`
	}
	if err := decodeJSON(r, &req); err != nil || req.FromSceneID == req.ToSceneID {
		badRequest(w, "bad body")
		return
	}
	if !s.requireChapterInSession(w, r, req.ChapterID, sess.ID) {
		return
	}
	from, ok := s.requireSceneInSession(w, r, req.FromSceneID, sess.ID)
	if !ok {
		return
	}
	to, ok := s.requireSceneInSession(w, r, req.ToSceneID, sess.ID)
	if !ok {
		return
	}
	if from.ChapterID != req.ChapterID || to.ChapterID != req.ChapterID {
		badRequest(w, "scenes must belong to the chapter")
		return
	}
	edge, err := s.store.CreateSceneEdge(r.Context(), req.ChapterID, req.FromSceneID, req.ToSceneID, cleanText(req.Label, 240))
	if store.IsUniqueViolation(err) {
		conflict(w, "link already exists")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, edge)
}

func (s *Server) handleDeleteSceneEdge(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	sess, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	edgeID, ok := sceneGraphPathInt64(w, r, "edgeId")
	if !ok {
		return
	}
	edge, err := s.store.GetSceneEdge(r.Context(), edgeID)
	if errors.Is(err, store.ErrNotFound) {
		notFound(w, "")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	if !s.requireChapterInSession(w, r, edge.ChapterID, sess.ID) {
		return
	}
	if err := s.store.DeleteSceneEdge(r.Context(), edgeID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleGetSceneBlockGraph(w http.ResponseWriter, r *http.Request) {
	sess, ok := s.requireSceneAccess(w, r)
	if !ok {
		return
	}
	sceneID, ok := sceneGraphPathInt64(w, r, "sceneId")
	if !ok {
		return
	}
	scene, ok := s.requireSceneInSession(w, r, sceneID, sess.ID)
	if !ok {
		return
	}
	items, err := s.store.GetSceneItems(r.Context(), sceneID)
	if err != nil {
		serverError(w, err)
		return
	}
	edges, err := s.store.GetSceneItemEdges(r.Context(), sceneID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"scene": scene, "items": nonNil(items), "edges": nonNil(edges)})
}

func (s *Server) requireItemInScene(w http.ResponseWriter, r *http.Request, itemID, sceneID int64) (store.SessionSceneItem, bool) {
	item, err := s.store.GetSceneItem(r.Context(), itemID)
	if errors.Is(err, store.ErrNotFound) {
		notFound(w, "")
		return store.SessionSceneItem{}, false
	}
	if err != nil {
		serverError(w, err)
		return store.SessionSceneItem{}, false
	}
	if item.SceneID != sceneID {
		badRequest(w, "blocks must belong to the scenario")
		return store.SessionSceneItem{}, false
	}
	return item, true
}

func (s *Server) handleCreateSceneBlockEdge(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	sess, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	var req struct {
		SceneID    int64   `json:"sceneId"`
		FromItemID int64   `json:"fromItemId"`
		ToItemID   int64   `json:"toItemId"`
		Label      *string `json:"label"`
	}
	if err := decodeJSON(r, &req); err != nil || req.FromItemID == req.ToItemID {
		badRequest(w, "bad body")
		return
	}
	if _, ok := s.requireSceneInSession(w, r, req.SceneID, sess.ID); !ok {
		return
	}
	if _, ok := s.requireItemInScene(w, r, req.FromItemID, req.SceneID); !ok {
		return
	}
	if _, ok := s.requireItemInScene(w, r, req.ToItemID, req.SceneID); !ok {
		return
	}
	edge, err := s.store.CreateSceneItemEdge(r.Context(), req.SceneID, req.FromItemID, req.ToItemID, cleanText(req.Label, 240))
	if store.IsUniqueViolation(err) {
		conflict(w, "link already exists")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, edge)
}

func (s *Server) handleDeleteSceneBlockEdge(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	sess, ok := s.requireSceneDm(w, r, userID)
	if !ok {
		return
	}
	edgeID, ok := sceneGraphPathInt64(w, r, "edgeId")
	if !ok {
		return
	}
	edge, err := s.store.GetSceneItemEdge(r.Context(), edgeID)
	if errors.Is(err, store.ErrNotFound) {
		notFound(w, "")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	if _, ok := s.requireSceneInSession(w, r, edge.SceneID, sess.ID); !ok {
		return
	}
	if err := s.store.DeleteSceneItemEdge(r.Context(), edgeID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

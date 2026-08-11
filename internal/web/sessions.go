package web

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dndshare/internal/store"
)

func init() { registerRoutes((*Server).routesSessions) }

func (s *Server) routesSessions(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/sessions", s.handleGetSessions)
	mux.HandleFunc("POST /api/sessions", s.handleCreateSession)
	mux.HandleFunc("DELETE /api/sessions/{uuid}/leave", s.handleLeaveSession)
	// Go's ServeMux падает на «перекрёстных» wildcard'ах: GET /api/sessions/by-code/{code}
	// (литерал в seg1) конфликтует с GET /api/sessions/{uuid}/{литерал} (литерал в seg2).
	// Поэтому все GET-роуты вида /api/sessions/<2 сегмента> обслуживает один
	// диспетчер, а он через SetPathValue вызывает нужный handler.
	mux.HandleFunc("GET /api/sessions/{a}/{b}", s.handleSessionTwoSegGET)
	mux.HandleFunc("GET /api/sessions/{uuid}", s.handleGetSession)
	mux.HandleFunc("PATCH /api/sessions/{uuid}", s.handleUpdateSession)
	mux.HandleFunc("POST /api/sessions/{uuid}/chapters", s.handleCreateChapter)
	mux.HandleFunc("PATCH /api/sessions/{uuid}/chapters/{chapterId}", s.handleRenameChapter)
	mux.HandleFunc("PATCH /api/sessions/{uuid}/current-chapter", s.handleSetCurrentChapter)
	mux.HandleFunc("POST /api/sessions/{uuid}/join", s.handleJoinSession)
	mux.HandleFunc("DELETE /api/sessions/{uuid}/participants/{charId}", s.handleKickParticipant)
	mux.HandleFunc("PATCH /api/sessions/{uuid}/status", s.handleUpdateSessionStatus)
	mux.HandleFunc("PUT /api/sessions/{uuid}/encounter", s.handleSaveEncounter)
	mux.HandleFunc("PUT /api/sessions/{uuid}/music", s.handleSaveMusicState)
	mux.HandleFunc("GET /api/sessions/{uuid}/music/tracks/{trackId}/url", s.handleGetSessionTrackURL)
	mux.HandleFunc("DELETE /api/sessions/{id}", s.handleDeleteSession)
}

// handleSessionTwoSegGET разводит GET-роуты /api/sessions/<seg1>/<seg2> (by-code/{code},
// {uuid}/chapters, {uuid}/encounter, {uuid}/music) — их нельзя зарегистрировать по отдельности
// из-за перекрёстных wildcard'ов ServeMux. Прокидываем seg-значения через SetPathValue, чтобы
// целевые хендлеры читали привычные PathValue("uuid")/PathValue("code").
func (s *Server) handleSessionTwoSegGET(w http.ResponseWriter, r *http.Request) {
	a := r.PathValue("a")
	b := r.PathValue("b")
	if a == "by-code" {
		r.SetPathValue("code", b)
		s.handleGetSessionByCode(w, r)
		return
	}
	r.SetPathValue("uuid", a)
	switch b {
	case "chapters":
		s.handleGetChapters(w, r)
	case "encounter":
		s.handleGetEncounter(w, r)
	case "music":
		s.handleGetMusicState(w, r)
	default:
		notFound(w, "")
	}
}

// sessionListItem — порт SessionController.SessionListItem.
type sessionListItem struct {
	Session        store.GameSession        `json:"session"`
	Participants   []store.ParticipantBrief `json:"participants"`
	MyRole         string                   `json:"myRole"`
	MyCharUUID     *string                  `json:"myCharUuid,omitempty"`
	CurrentChapter *store.ChapterBrief      `json:"currentChapter,omitempty"`
}

type sessionsResponse struct {
	Sessions []sessionListItem `json:"sessions"`
}

func (s *Server) handleGetSessions(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	gmSessions, err := s.store.GetOwnerSessions(ctx, userID)
	if err != nil {
		serverError(w, err)
		return
	}
	playerSessions, err := s.store.GetPlayerSessions(ctx, userID)
	if err != nil {
		serverError(w, err)
		return
	}
	allIDs := make([]int64, 0, len(gmSessions)+len(playerSessions))
	for _, g := range gmSessions {
		allIDs = append(allIDs, g.ID)
	}
	playerIDs := make([]int64, 0, len(playerSessions))
	for _, g := range playerSessions {
		allIDs = append(allIDs, g.ID)
		playerIDs = append(playerIDs, g.ID)
	}
	participants, err := s.store.GetSessionParticipantsBrief(ctx, allIDs)
	if err != nil {
		serverError(w, err)
		return
	}
	myCharUuids, err := s.store.GetMyCharUuids(ctx, playerIDs, userID)
	if err != nil {
		serverError(w, err)
		return
	}
	chapters, err := s.store.GetCurrentChapters(ctx, allIDs)
	if err != nil {
		serverError(w, err)
		return
	}
	items := make([]sessionListItem, 0, len(gmSessions)+len(playerSessions))
	for _, g := range gmSessions {
		items = append(items, buildListItem(g, participants[g.ID], "gm", nil, chapters))
	}
	for _, g := range playerSessions {
		var myUUID *string
		if u, ok := myCharUuids[g.ID]; ok {
			myUUID = &u
		}
		items = append(items, buildListItem(g, participants[g.ID], "player", myUUID, chapters))
	}
	writeJSON(w, http.StatusOK, sessionsResponse{Sessions: items})
}

func buildListItem(g store.GameSession, parts []store.ParticipantBrief, role string, myUUID *string, chapters map[int64]store.ChapterBrief) sessionListItem {
	item := sessionListItem{
		Session:      g,
		Participants: nonNil(parts),
		MyRole:       role,
		MyCharUUID:   myUUID,
	}
	if ch, ok := chapters[g.ID]; ok {
		cp := ch
		item.CurrentChapter = &cp
	}
	return item
}

type createSessionRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	SystemID    *int64  `json:"systemId"`
}

type sessionCreatedResponse struct {
	ID   int64  `json:"id"`
	UUID string `json:"uuid"`
}

func (s *Server) handleCreateSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	var req createSessionRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	id, uuid, err := s.store.CreateSessionWithFirstChapter(r.Context(), userID, req.Name, req.Description, req.SystemID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sessionCreatedResponse{ID: id, UUID: uuid})
}

func (s *Server) handleLeaveSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if err := s.store.RemoveSessionParticipant(r.Context(), session.ID, userID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

type sessionDetailResponse struct {
	Session        store.GameSession              `json:"session"`
	Participants   []store.SessionParticipantData `json:"participants"`
	CurrentChapter *store.SessionChapter          `json:"currentChapter,omitempty"`
}

func (s *Server) handleGetSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	participants, err := s.store.GetSessionParticipants(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	resp := sessionDetailResponse{Session: session, Participants: nonNil(participants)}
	if session.CurrentChapterID != nil {
		chapter, err := s.store.GetChapterByID(r.Context(), *session.CurrentChapterID)
		if err == nil {
			resp.CurrentChapter = &chapter
		} else if !errors.Is(err, store.ErrNotFound) {
			serverError(w, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

type chaptersResponse struct {
	Chapters []store.SessionChapter `json:"chapters"`
}

func (s *Server) handleGetChapters(w http.ResponseWriter, r *http.Request) {
	if _, ok := mustUser(w, r); !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	chapters, err := s.store.GetChaptersBySession(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, chaptersResponse{Chapters: nonNil(chapters)})
}

type createChapterRequest struct {
	Name string `json:"name"`
}

func (s *Server) handleCreateChapter(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	var req createChapterRequest
	if err := decodeJSON(r, &req); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		badRequest(w, "")
		return
	}
	chapter, err := s.store.CreateChapter(r.Context(), session.ID, name)
	if err != nil {
		serverError(w, err)
		return
	}
	if err := s.store.UpdateCurrentChapter(r.Context(), session.UUID, &chapter.ID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, chapter)
}

type renameChapterRequest struct {
	Name string `json:"name"`
}

func (s *Server) handleRenameChapter(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	chapterID, err := strconv.ParseInt(r.PathValue("chapterId"), 10, 64)
	if err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	chapter, err := s.store.GetChapterByID(r.Context(), chapterID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return
		}
		serverError(w, err)
		return
	}
	if chapter.SessionID != session.ID {
		badRequest(w, "")
		return
	}
	var body renameChapterRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		badRequest(w, "")
		return
	}
	if err := s.store.RenameChapter(r.Context(), chapterID, name); err != nil {
		serverError(w, err)
		return
	}
	updated, err := s.store.GetChapterByID(r.Context(), chapterID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

type setCurrentChapterRequest struct {
	ChapterID *int64 `json:"chapterId"`
}

func (s *Server) handleSetCurrentChapter(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	var body setCurrentChapterRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if body.ChapterID != nil {
		chapter, err := s.store.GetChapterByID(r.Context(), *body.ChapterID)
		if err != nil {
			if errors.Is(err, store.ErrNotFound) {
				notFound(w, "")
				return
			}
			serverError(w, err)
			return
		}
		if chapter.SessionID != session.ID {
			badRequest(w, "")
			return
		}
	}
	if err := s.store.UpdateCurrentChapter(r.Context(), session.UUID, body.ChapterID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

type sessionByCodeResponse struct {
	UUID          string  `json:"uuid"`
	Name          string  `json:"name"`
	Description   *string `json:"description,omitempty"`
	Status        string  `json:"status"`
	SystemName    *string `json:"systemName,omitempty"`
	ChapterNumber *int64  `json:"chapterNumber,omitempty"`
	ChapterName   *string `json:"chapterName,omitempty"`
}

func (s *Server) handleGetSessionByCode(w http.ResponseWriter, r *http.Request) {
	if _, ok := mustUser(w, r); !ok {
		return
	}
	code := r.PathValue("code")
	session, err := s.store.GetGameSessionByInviteCode(r.Context(), code)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return
		}
		serverError(w, err)
		return
	}
	resp := sessionByCodeResponse{
		UUID:        session.UUID,
		Name:        session.Name,
		Description: session.Description,
		Status:      session.Status,
		SystemName:  session.SystemName,
	}
	if session.CurrentChapterID != nil {
		chapter, err := s.store.GetChapterByID(r.Context(), *session.CurrentChapterID)
		if err == nil {
			resp.ChapterNumber = &chapter.Number
			resp.ChapterName = &chapter.Name
		} else if !errors.Is(err, store.ErrNotFound) {
			serverError(w, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, resp)
}

type joinSessionRequest struct {
	CharID int64 `json:"charId"`
}

func (s *Server) handleJoinSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	var body joinSessionRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	owned, err := s.store.IsCharOwnedBy(r.Context(), body.CharID, userID)
	if err != nil {
		serverError(w, err)
		return
	}
	if !owned {
		forbidden(w)
		return
	}
	if err := s.store.AddSessionParticipant(r.Context(), session.ID, body.CharID, userID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

type updateSessionRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

func (s *Server) handleUpdateSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	var body updateSessionRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if err := s.store.UpdateSession(r.Context(), session.UUID, body.Name, body.Description); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleKickParticipant(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	charID, err := strconv.ParseInt(r.PathValue("charId"), 10, 64)
	if err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if err := s.store.RemoveSessionParticipantByCharID(r.Context(), session.ID, charID); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

type updateStatusRequest struct {
	Status string `json:"status"`
}

func (s *Server) handleUpdateSessionStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	var body updateStatusRequest
	if err := decodeJSON(r, &body); err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if err := s.store.UpdateSessionStatus(r.Context(), session.UUID, body.Status); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleGetEncounter(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	data, err := s.store.GetEncounterData(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeRawJSON(w, data)
}

func (s *Server) handleSaveEncounter(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxJSONBody))
	if err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if !json.Valid(raw) {
		badRequest(w, "Некорректный запрос")
		return
	}
	var meta struct {
		Active bool `json:"active"`
		Round  int  `json:"round"`
	}
	_ = json.Unmarshal(raw, &meta)
	status := "pending"
	if meta.Active {
		status = "active"
	}
	if err := s.store.SaveEncounterData(r.Context(), session.ID, status, meta.Round, string(raw)); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (s *Server) handleGetMusicState(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	data, err := s.store.GetMusicStateData(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	writeRawJSON(w, data)
}

func (s *Server) handleSaveMusicState(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxJSONBody))
	if err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	if !json.Valid(raw) {
		badRequest(w, "Некорректный запрос")
		return
	}
	if err := s.store.SaveMusicStateData(r.Context(), session.ID, string(raw)); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

type musicTrackURLResponse struct {
	URL    string `json:"url"`
	TTLSec int64  `json:"ttlSec"`
}

func (s *Server) handleGetSessionTrackURL(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	session, err := s.lookupSession(w, r)
	if err != nil {
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	trackID, err := strconv.ParseInt(r.PathValue("trackId"), 10, 64)
	if err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	fileKey, ownerUserID, err := s.store.GetMusicTrackFileKey(r.Context(), trackID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return
		}
		serverError(w, err)
		return
	}
	if ownerUserID != session.OwnerUserID {
		forbidden(w)
		return
	}
	url, err := s.s3.PresignGet(r.Context(), fileKey, 3600*time.Second)
	if err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, musicTrackURLResponse{URL: url, TTLSec: 3600})
}

func (s *Server) handleDeleteSession(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		badRequest(w, "Некорректный запрос")
		return
	}
	session, err := s.store.GetGameSession(r.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
			return
		}
		serverError(w, err)
		return
	}
	if session.OwnerUserID != userID {
		forbidden(w)
		return
	}
	if err := s.store.DeleteGameSession(r.Context(), id); err != nil {
		serverError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

// lookupSession читает сессию по {uuid} из пути, отдавая 404 при отсутствии.
// Возвращает ошибку, если ответ уже записан (вызывающему нужно только выйти).
func (s *Server) lookupSession(w http.ResponseWriter, r *http.Request) (store.GameSession, error) {
	uuid := r.PathValue("uuid")
	if !isUUID(uuid) {
		notFound(w, "")
		return store.GameSession{}, store.ErrNotFound
	}
	session, err := s.store.GetGameSessionByUUID(r.Context(), uuid)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
		} else {
			serverError(w, err)
		}
		return store.GameSession{}, err
	}
	return session, nil
}

// writeRawJSON пишет уже готовую JSON-строку (энкаунтер/музыка), по умолчанию "{}".
func writeRawJSON(w http.ResponseWriter, data *string) {
	body := "{}"
	if data != nil {
		body = *data
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(body))
}

package web

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"dndshare/internal/store"
)

const handbookSyncProtocol = 1

type handbookSyncCursor struct {
	Protocol int                        `json:"v"`
	UserID   int64                      `json:"u"`
	SourceID int64                      `json:"s"`
	Page     bool                       `json:"p"`
	Position store.HandbookSyncPosition `json:"position"`
}

func encodeHandbookCursor(cursor handbookSyncCursor) string {
	data, _ := json.Marshal(cursor)
	return base64.RawURLEncoding.EncodeToString(data)
}

func decodeHandbookCursor(raw string, userID, sourceID int64) (handbookSyncCursor, error) {
	var cursor handbookSyncCursor
	if len(raw) > 2048 {
		return cursor, errors.New("invalid cursor")
	}
	data, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil || json.Unmarshal(data, &cursor) != nil {
		return cursor, errors.New("invalid cursor")
	}
	p := cursor.Position
	if cursor.Protocol != handbookSyncProtocol || cursor.UserID != userID || cursor.SourceID != sourceID ||
		p.BaseRevision < -1 || p.Revision < 0 || p.LastID < 0 || p.MaxID < p.LastID ||
		p.BaseRevision > p.Revision || (!cursor.Page && (p.LastID != 0 || p.MaxID != 0 || p.BaseRevision != p.Revision)) {
		return cursor, errors.New("cursor does not match this catalogue")
	}
	return cursor, nil
}

func init() { registerRoutes((*Server).routesHandbookSync) }

func (s *Server) routesHandbookSync(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/handbook/sync", s.handleHandbookSync)
}

func (s *Server) handleHandbookSync(w http.ResponseWriter, r *http.Request) {
	userID, ok := mustUser(w, r)
	if !ok {
		return
	}
	sourceID, err := strconv.ParseInt(r.URL.Query().Get("sourceId"), 10, 64)
	if err != nil || sourceID <= 0 {
		badRequest(w, "Выберите игровую систему")
		return
	}
	cursor := handbookSyncCursor{Protocol: handbookSyncProtocol, UserID: userID, SourceID: sourceID}
	cursor.Position.BaseRevision = -1
	raw := r.URL.Query().Get("cursor")
	if raw != "" {
		cursor, err = decodeHandbookCursor(raw, userID, sourceID)
		if err != nil {
			writeJSON(w, http.StatusConflict, map[string]any{"type": "SYNC_RESET_REQUIRED", "desc": "Начните синхронизацию заново"})
			return
		}
	}
	head, err := s.store.HandbookSyncStart(r.Context(), userID, sourceID, cursor.Position.BaseRevision)
	if errors.Is(err, store.ErrNotFound) {
		badRequest(w, "Игровая система не найдена")
		return
	}
	if err != nil {
		serverError(w, err)
		return
	}
	if cursor.Position.Revision > head.Revision {
		writeJSON(w, http.StatusConflict, map[string]any{"type": "SYNC_RESET_REQUIRED", "desc": "Каталог был восстановлен; обновите локальную копию"})
		return
	}
	if !cursor.Page {
		if raw != "" {
			head.BaseRevision = cursor.Position.Revision
		}
		cursor.Position = head
	}
	page, err := s.store.HandbookSync(r.Context(), userID, sourceID, cursor.Position, coerceIn(queryInt(r.URL.Query(), "limit", 200), 1, 250))
	if err != nil {
		serverError(w, err)
		return
	}
	reply := map[string]any{
		"protocol": handbookSyncProtocol, "entries": page.Entries, "hasMore": page.HasMore,
		"full": cursor.Position.BaseRevision < 0, "serverTime": time.Now().UTC().Format(time.RFC3339Nano),
	}
	if page.Metadata != nil {
		reply["metadata"] = page.Metadata
	}
	cursor.Page = page.HasMore
	cursor.Position = page.Position
	if page.HasMore {
		reply["nextCursor"] = encodeHandbookCursor(cursor)
	} else {
		cursor.Position = store.HandbookSyncPosition{BaseRevision: page.Position.Revision, Revision: page.Position.Revision}
		reply["cursor"] = encodeHandbookCursor(cursor)
		reply["visibleIds"] = page.VisibleIDs
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, reply)
}

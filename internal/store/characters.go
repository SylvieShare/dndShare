package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// CharacterItem — строка dndshare."char" (порт CharacterItem + CharacterRepository.rowMapper).
type CharacterItem struct {
	ID              int64           `json:"id"`
	UUID            string          `json:"uuid"`
	UserID          int64           `json:"userId"`
	TemplateID      int64           `json:"templateId"`
	SourceVersionID *int64          `json:"sourceVersionId,omitempty"`
	SourceID        *int64          `json:"sourceId,omitempty"`
	SourceName      *string         `json:"sourceName,omitempty"`
	SourceVersion   *string         `json:"sourceVersion,omitempty"`
	Data            json.RawMessage `json:"data"`
	PublicVisible   bool            `json:"publicVisible"`
	Deleted         bool            `json:"deleted"`
	CreatedAt       time.Time       `json:"createdAt"`
	ChangedAt       time.Time       `json:"changedAt"`
	Version         int64           `json:"version"`
}

// PathUpdate — одно точечное изменение data по пути (порт CharacterRepository.PathUpdate).
type PathUpdate struct {
	Path  string
	Value json.RawMessage
}

// PollItem — запрос опроса версии персонажа (порт CharacterRepository.PollItem).
type PollItem struct {
	CharID  int64 `json:"charId"`
	Version int64 `json:"version"`
}

// PollResult — ответ опроса (порт CharacterRepository.PollResult, NON_NULL: data/version опускаются).
type PollResult struct {
	CharID  int64           `json:"charId"`
	Changed bool            `json:"changed"`
	Data    json.RawMessage `json:"data,omitempty"`
	Version *int64          `json:"version,omitempty"`
}

// CharSessionBrief — краткая сводка сессии для персонажа (порт GameSessionRepository.CharSessionBrief).
type CharSessionBrief struct {
	UUID          string  `json:"uuid"`
	Name          string  `json:"name"`
	Status        string  `json:"status"`
	ChapterNumber *int    `json:"chapterNumber,omitempty"`
	ChapterName   *string `json:"chapterName,omitempty"`
	IsGm          bool    `json:"isGm"`
}

const characterCols = `c.id, c.uuid::text, c.user_id, c.template_id,
 c.source_version_id, sv.source_id, src.name, sv.version,
 c.data, c.public_visible, c.deleted, c.created_at, c.changed_at, c."version"`

func scanCharacter(row pgx.Row) (CharacterItem, error) {
	var c CharacterItem
	var data []byte
	err := row.Scan(&c.ID, &c.UUID, &c.UserID, &c.TemplateID,
		&c.SourceVersionID, &c.SourceID, &c.SourceName, &c.SourceVersion,
		&data, &c.PublicVisible, &c.Deleted, &c.CreatedAt, &c.ChangedAt, &c.Version)
	if err != nil {
		return CharacterItem{}, err
	}
	c.Data = json.RawMessage(data)
	return c, nil
}

// GetCharacter возвращает персонажа по uuid (ErrNotFound, если нет либо удалён).
func (s *Store) GetCharacter(ctx context.Context, uuid string) (CharacterItem, error) {
	c, err := scanCharacter(s.pool.QueryRow(ctx,
		`SELECT `+characterCols+`
		 FROM dndshare."char" c
		 LEFT JOIN dndshare.source_version sv ON sv.id = c.source_version_id
		 LEFT JOIN dndshare.source src ON src.id = sv.source_id
		 WHERE c.uuid = $1::uuid AND c.deleted = false`, uuid))
	if errors.Is(err, pgx.ErrNoRows) {
		return CharacterItem{}, ErrNotFound
	}
	return c, err
}

// GetCharacters — персонажи пользователя (свежие сверху).
func (s *Store) GetCharacters(ctx context.Context, userID int64) ([]CharacterItem, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+characterCols+`
		 FROM dndshare."char" c
		 LEFT JOIN dndshare.source_version sv ON sv.id = c.source_version_id
		 LEFT JOIN dndshare.source src ON src.id = sv.source_id
		 WHERE c.user_id = $1 AND c.deleted = false
		 ORDER BY c.changed_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CharacterItem
	for rows.Next() {
		c, err := scanCharacter(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// CreateCharacter вставляет нового персонажа и возвращает его uuid.
func (s *Store) CreateCharacter(ctx context.Context, userID, templateID int64, sourceVersionID *int64, data json.RawMessage) (string, error) {
	if len(data) == 0 {
		data = json.RawMessage("{}")
	}
	var uuid string
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare."char" (user_id, template_id, source_version_id, data, public_visible)
		 VALUES ($1, $2, $3, CAST($4 AS jsonb), true) RETURNING uuid::text`,
		userID, templateID, sourceVersionID, string(data),
	).Scan(&uuid)
	return uuid, err
}

// UpdateDataCharacter полностью перезаписывает data (bump changed_at/version).
func (s *Store) UpdateDataCharacter(ctx context.Context, uuid string, data json.RawMessage) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare."char" SET data = CAST($2 AS jsonb), changed_at = now(), version = version + 1 WHERE uuid = $1::uuid`,
		uuid, string(data),
	)
	return err
}

// UpdateDataByPaths точечно правит data через jsonb_set по каждому пути (порт updateDataByPaths).
func (s *Store) UpdateDataByPaths(ctx context.Context, uuid string, updates []PathUpdate) error {
	if len(updates) == 0 {
		return nil
	}
	params := []any{uuid}
	expr := "data::jsonb"
	arg := 1
	for _, u := range updates {
		keys := strings.Split(u.Path, ".")
		keyPlaceholders := make([]string, len(keys))
		for i, k := range keys {
			arg++
			params = append(params, k)
			keyPlaceholders[i] = fmt.Sprintf("$%d", arg)
		}
		arg++
		val := "null"
		if len(u.Value) > 0 {
			val = string(u.Value)
		}
		params = append(params, val)
		expr = fmt.Sprintf("jsonb_set(%s, ARRAY[%s]::text[], $%d::jsonb, true)", expr, strings.Join(keyPlaceholders, ", "), arg)
	}
	sql := fmt.Sprintf(
		`UPDATE dndshare."char" SET data = (%s)::json, changed_at = now(), version = version + 1 WHERE uuid = $1::uuid`, expr)
	_, err := s.pool.Exec(ctx, sql, params...)
	return err
}

// UpdatePublicVisible переключает публичность (без bump версии — как в оригинале).
func (s *Store) UpdatePublicVisible(ctx context.Context, uuid string, publicVisible bool) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare."char" SET public_visible = $2 WHERE uuid = $1::uuid`, uuid, publicVisible)
	return err
}

// DeleteCharacter — мягкое удаление.
func (s *Store) DeleteCharacter(ctx context.Context, uuid string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare."char" SET deleted = true WHERE uuid = $1::uuid`, uuid)
	return err
}

// PollChars возвращает по каждому запрошенному id, изменился ли data относительно клиентской версии.
// Отдаёт данные только тех персонажей, которые вызывающий вправе видеть: свои, публичные или
// делящие с ним сессию (мастер опрашивает игроков, игроки — соигроков). Чужие id молча выпадают
// из выборки — это чинит IDOR-перечисление приватных листов по числовому id.
func (s *Store) PollChars(ctx context.Context, items []PollItem, userID int64) ([]PollResult, error) {
	if len(items) == 0 {
		return []PollResult{}, nil
	}
	ids := make([]int64, 0, len(items))
	clientVersion := make(map[int64]int64, len(items))
	for _, it := range items {
		ids = append(ids, it.CharID)
		clientVersion[it.CharID] = it.Version
	}
	rows, err := s.pool.Query(ctx,
		`SELECT c.id, c.data, c."version"
		 FROM dndshare."char" c
		 WHERE c.id = ANY($1) AND c.deleted = false
		   AND (
		     c.user_id = $2
		     OR c.public_visible = true
		     OR EXISTS (
		       SELECT 1 FROM dndshare.session_participant sp
		       JOIN dndshare."session" s ON s.id = sp.session_id AND s.deleted = false
		       WHERE sp.char_id = c.id
		         AND (
		           s.owner_user_id = $2
		           OR EXISTS (
		             SELECT 1 FROM dndshare.session_participant sp2
		             WHERE sp2.session_id = s.id AND sp2.user_id = $2
		           )
		         )
		     )
		   )`, ids, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []PollResult{}
	for rows.Next() {
		var charID, dbVersion int64
		var data []byte
		if err := rows.Scan(&charID, &data, &dbVersion); err != nil {
			return nil, err
		}
		cv, ok := clientVersion[charID]
		if !ok {
			cv = -1
		}
		if dbVersion > cv {
			v := dbVersion
			out = append(out, PollResult{CharID: charID, Changed: true, Data: json.RawMessage(data), Version: &v})
		} else {
			out = append(out, PollResult{CharID: charID, Changed: false})
		}
	}
	return out, rows.Err()
}

// --- templates (CharacterTemplateRepository) ---
// CharacterTemplate, GetTemplate и mapTemplate объявлены в templates.go.

// GetTemplates — все шаблоны по возрастанию id (порт getTemplates).
func (s *Store) GetTemplates(ctx context.Context) ([]CharacterTemplate, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, name, schema, create_form, path_values_for_list FROM dndshare.char_template ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CharacterTemplate
	for rows.Next() {
		var id int64
		var name string
		var schema, createForm, pathValues *[]byte
		if err := rows.Scan(&id, &name, &schema, &createForm, &pathValues); err != nil {
			return nil, err
		}
		t := mapTemplate(schema, createForm, pathValues)
		t.ID = id
		t.Name = name
		out = append(out, t)
	}
	return out, rows.Err()
}

// --- char <-> session helpers (используются только CharacterController) ---

func scanCharSession(row pgx.Row, extra ...any) (CharSessionBrief, error) {
	var b CharSessionBrief
	dst := append(extra, &b.UUID, &b.Name, &b.Status, &b.ChapterNumber, &b.ChapterName, &b.IsGm)
	if err := row.Scan(dst...); err != nil {
		return CharSessionBrief{}, err
	}
	return b, nil
}

// SessionsByCharUUID — сессии, где участвует персонаж (порт getSessionsByCharUuid).
func (s *Store) SessionsByCharUUID(ctx context.Context, charUUID string, userID int64) ([]CharSessionBrief, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT s.uuid::text, s.name, s.status, ch.number AS chapter_number, ch.name AS chapter_name,
		        (s.owner_user_id = $2) AS is_gm
		 FROM dndshare."session" s
		 JOIN dndshare.session_participant sp ON sp.session_id = s.id
		 JOIN dndshare."char" c ON c.id = sp.char_id AND c.deleted = false
		 LEFT JOIN dndshare.session_chapter ch ON ch.id = s.current_chapter_id
		 WHERE c.uuid = $1::uuid AND s.deleted = false
		 ORDER BY s.changed_at DESC`, charUUID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CharSessionBrief
	for rows.Next() {
		b, err := scanCharSession(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// SessionsByCharUUIDs — карта uuid персонажа -> его сессии (порт getSessionsByCharUuids).
func (s *Store) SessionsByCharUUIDs(ctx context.Context, charUUIDs []string, userID int64) (map[string][]CharSessionBrief, error) {
	result := map[string][]CharSessionBrief{}
	if len(charUUIDs) == 0 {
		return result, nil
	}
	rows, err := s.pool.Query(ctx,
		`SELECT c.uuid::text AS char_uuid, s.uuid::text, s.name, s.status, ch.number AS chapter_number, ch.name AS chapter_name,
		        (s.owner_user_id = $2) AS is_gm
		 FROM dndshare."session" s
		 JOIN dndshare.session_participant sp ON sp.session_id = s.id
		 JOIN dndshare."char" c ON c.id = sp.char_id AND c.deleted = false
		 LEFT JOIN dndshare.session_chapter ch ON ch.id = s.current_chapter_id
		 WHERE c.uuid::text = ANY($1) AND s.deleted = false
		 ORDER BY s.changed_at DESC`, charUUIDs, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var charUUID string
		b, err := scanCharSession(rows, &charUUID)
		if err != nil {
			return nil, err
		}
		result[charUUID] = append(result[charUUID], b)
	}
	return result, rows.Err()
}

// IsCharInSessionOwnedBy — участвует ли персонаж в сессии, которой владеет данный пользователь (порт isCharInSessionOwnedBy).
func (s *Store) IsCharInSessionOwnedBy(ctx context.Context, charUUID string, ownerUserID int64) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(
		 SELECT 1
		 FROM dndshare.session_participant sp
		 JOIN dndshare."char" c ON c.id = sp.char_id AND c.deleted = false
		 JOIN dndshare."session" s ON s.id = sp.session_id
		 WHERE c.uuid = $1::uuid AND s.owner_user_id = $2 AND s.deleted = false)`,
		charUUID, ownerUserID,
	).Scan(&exists)
	return exists, err
}

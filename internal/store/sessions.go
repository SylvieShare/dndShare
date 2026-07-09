package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// GameSession — строка dndshare.session (порт model/GameSession.kt).
type GameSession struct {
	ID               int64     `json:"id"`
	UUID             string    `json:"uuid"`
	OwnerUserID      int64     `json:"ownerUserId"`
	Name             string    `json:"name"`
	Description      *string   `json:"description,omitempty"`
	SystemID         *int64    `json:"systemId,omitempty"`
	SystemName       *string   `json:"systemName,omitempty"`
	InviteCode       string    `json:"inviteCode"`
	Status           string    `json:"status"`
	CurrentChapterID *int64    `json:"currentChapterId,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
	ChangedAt        time.Time `json:"changedAt"`
}

// SessionChapter — строка dndshare.session_chapter (порт model/SessionChapter.kt).
type SessionChapter struct {
	ID        int64  `json:"id"`
	SessionID int64  `json:"sessionId"`
	Number    int64  `json:"number"`
	Name      string `json:"name"`
}

// SessionParticipantData — участник сессии с данными персонажа (порт model/SessionParticipantData.kt).
type SessionParticipantData struct {
	CharID       int64             `json:"charId"`
	CharUUID     string            `json:"charUuid"`
	TemplateID   int64             `json:"templateId"`
	TemplateName string            `json:"templateName"`
	PathValues   map[string]string `json:"pathValues,omitempty"`
	Data         map[string]any    `json:"data"`
	Role         string            `json:"role"`
}

// ParticipantBrief — краткая инфа об участнике для списка сессий.
type ParticipantBrief struct {
	CharUUID string  `json:"charUuid"`
	AvaURL   *string `json:"avaUrl,omitempty"`
}

// ChapterBrief — краткая инфа о текущей главе для списка сессий.
type ChapterBrief struct {
	Number int    `json:"number"`
	Name   string `json:"name"`
}

// sessionSelect — общий SELECT сессии с именем системы (LEFT JOIN source).
const sessionSelect = `
	SELECT s.id, s.uuid::text, s.owner_user_id, s.name, s.description, s.system_id,
	       src.name AS source_name, s.invite_code, s.status, s.current_chapter_id,
	       s.created_at, s.changed_at
	FROM dndshare."session" s
	LEFT JOIN dndshare."source" src ON src.id = s.system_id`

func scanGameSession(row pgx.Row) (GameSession, error) {
	var g GameSession
	err := row.Scan(&g.ID, &g.UUID, &g.OwnerUserID, &g.Name, &g.Description, &g.SystemID,
		&g.SystemName, &g.InviteCode, &g.Status, &g.CurrentChapterID, &g.CreatedAt, &g.ChangedAt)
	return g, err
}

func (s *Store) queryGameSessions(ctx context.Context, sql string, args ...any) ([]GameSession, error) {
	rows, err := s.pool.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []GameSession
	for rows.Next() {
		g, err := scanGameSession(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

// GetOwnerSessions — сессии, где пользователь мастер (порт getSessions).
func (s *Store) GetOwnerSessions(ctx context.Context, userID int64) ([]GameSession, error) {
	return s.queryGameSessions(ctx,
		sessionSelect+` WHERE s.owner_user_id = $1 AND s.deleted = false ORDER BY s.changed_at DESC`,
		userID,
	)
}

// GetPlayerSessions — сессии, где пользователь игрок, но не мастер (порт getPlayerSessions).
func (s *Store) GetPlayerSessions(ctx context.Context, userID int64) ([]GameSession, error) {
	return s.queryGameSessions(ctx,
		sessionSelect+`
		JOIN dndshare.session_participant sp ON sp.session_id = s.id
		WHERE sp.user_id = $1 AND s.owner_user_id != $1 AND s.deleted = false
		ORDER BY s.changed_at DESC`,
		userID,
	)
}

// GetGameSession — сессия по id (ErrNotFound, если нет).
func (s *Store) GetGameSession(ctx context.Context, id int64) (GameSession, error) {
	g, err := scanGameSession(s.pool.QueryRow(ctx,
		sessionSelect+` WHERE s.id = $1 AND s.deleted = false`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return GameSession{}, ErrNotFound
	}
	return g, err
}

// GetGameSessionByUUID — сессия по uuid (ErrNotFound, если нет).
func (s *Store) GetGameSessionByUUID(ctx context.Context, uuid string) (GameSession, error) {
	g, err := scanGameSession(s.pool.QueryRow(ctx,
		sessionSelect+` WHERE s.uuid = $1::uuid AND s.deleted = false`, uuid))
	if errors.Is(err, pgx.ErrNoRows) {
		return GameSession{}, ErrNotFound
	}
	return g, err
}

// GetGameSessionByInviteCode — сессия по инвайт-коду (ErrNotFound, если нет).
func (s *Store) GetGameSessionByInviteCode(ctx context.Context, code string) (GameSession, error) {
	g, err := scanGameSession(s.pool.QueryRow(ctx,
		sessionSelect+` WHERE s.invite_code = $1 AND s.deleted = false`, code))
	if errors.Is(err, pgx.ErrNoRows) {
		return GameSession{}, ErrNotFound
	}
	return g, err
}

// GetSessionParticipants — участники сессии с полными данными персонажей (порт getParticipants).
func (s *Store) GetSessionParticipants(ctx context.Context, sessionID int64) ([]SessionParticipantData, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT sp.char_id, sp.role, c.uuid::text AS char_uuid, c.data AS char_data,
		        c.template_id, ct.path_values_for_list AS path_values, ct.name AS template_name
		 FROM dndshare.session_participant sp
		 JOIN dndshare."char" c ON c.id = sp.char_id AND c.deleted = false
		 JOIN dndshare.char_template ct ON ct.id = c.template_id
		 WHERE sp.session_id = $1
		 ORDER BY sp.joined_at`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SessionParticipantData
	for rows.Next() {
		var p SessionParticipantData
		var charData []byte
		var pathValues *[]byte
		if err := rows.Scan(&p.CharID, &p.Role, &p.CharUUID, &charData, &p.TemplateID, &pathValues, &p.TemplateName); err != nil {
			return nil, err
		}
		if pathValues != nil {
			var pv map[string]string
			if json.Unmarshal(*pathValues, &pv) == nil {
				p.PathValues = pv
			}
		}
		_ = json.Unmarshal(charData, &p.Data)
		out = append(out, p)
	}
	return out, rows.Err()
}

// GetSessionParticipantsBrief — краткая инфа об участниках для списка (порт getParticipantsBrief).
func (s *Store) GetSessionParticipantsBrief(ctx context.Context, sessionIDs []int64) (map[int64][]ParticipantBrief, error) {
	result := map[int64][]ParticipantBrief{}
	if len(sessionIDs) == 0 {
		return result, nil
	}
	rows, err := s.pool.Query(ctx,
		`SELECT sp.session_id, c.uuid::text, c.data AS char_data, ct.path_values_for_list AS path_values
		 FROM dndshare.session_participant sp
		 JOIN dndshare."char" c ON c.id = sp.char_id AND c.deleted = false
		 JOIN dndshare.char_template ct ON ct.id = c.template_id
		 WHERE sp.session_id = ANY($1)
		 ORDER BY sp.joined_at`,
		sessionIDs,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var sid int64
		var charUUID string
		var charData []byte
		var pathValues *[]byte
		if err := rows.Scan(&sid, &charUUID, &charData, &pathValues); err != nil {
			return nil, err
		}
		pv := map[string]string{}
		if pathValues != nil {
			_ = json.Unmarshal(*pathValues, &pv)
		}
		// path_values_for_list устаревает; путь к аватарке по умолчанию — values.ava.
		avaPath := pv["ava"]
		if avaPath == "" {
			avaPath = "values.ava"
		}
		var data any
		_ = json.Unmarshal(charData, &data)
		var avaURL *string
		if v := extractByPath(data, avaPath); v != nil {
			sv := fmt.Sprintf("%v", v)
			if strings.TrimSpace(sv) != "" {
				avaURL = &sv
			}
		}
		result[sid] = append(result[sid], ParticipantBrief{CharUUID: charUUID, AvaURL: avaURL})
	}
	return result, rows.Err()
}

func extractByPath(obj any, path string) any {
	cur := obj
	for _, key := range strings.Split(path, ".") {
		m, ok := cur.(map[string]any)
		if !ok {
			return nil
		}
		cur = m[key]
		if cur == nil {
			return nil
		}
	}
	return cur
}

// GetMyCharUuids — карта sessionId -> uuid моего персонажа в этих сессиях (порт getMyCharUuids).
func (s *Store) GetMyCharUuids(ctx context.Context, sessionIDs []int64, userID int64) (map[int64]string, error) {
	result := map[int64]string{}
	if len(sessionIDs) == 0 {
		return result, nil
	}
	rows, err := s.pool.Query(ctx,
		`SELECT sp.session_id, c.uuid::text
		 FROM dndshare.session_participant sp
		 JOIN dndshare."char" c ON c.id = sp.char_id AND c.deleted = false
		 WHERE sp.session_id = ANY($1) AND sp.user_id = $2`,
		sessionIDs, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var sid int64
		var uuid string
		if err := rows.Scan(&sid, &uuid); err != nil {
			return nil, err
		}
		result[sid] = uuid
	}
	return result, rows.Err()
}

// GetCurrentChapters — карта sessionId -> текущая глава (порт getCurrentChapters).
func (s *Store) GetCurrentChapters(ctx context.Context, sessionIDs []int64) (map[int64]ChapterBrief, error) {
	result := map[int64]ChapterBrief{}
	if len(sessionIDs) == 0 {
		return result, nil
	}
	rows, err := s.pool.Query(ctx,
		`SELECT s.id, ch.number, ch.name
		 FROM dndshare."session" s
		 JOIN dndshare.session_chapter ch ON ch.id = s.current_chapter_id
		 WHERE s.id = ANY($1)`,
		sessionIDs,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var sid int64
		var cb ChapterBrief
		if err := rows.Scan(&sid, &cb.Number, &cb.Name); err != nil {
			return nil, err
		}
		result[sid] = cb
	}
	return result, rows.Err()
}

// CreateSessionWithFirstChapter создаёт сессию, первую главу «Вступление» и делает её
// текущей — всё в одной транзакции (порт SessionController.createSession).
func (s *Store) CreateSessionWithFirstChapter(ctx context.Context, userID int64, name string, description *string, systemID *int64) (int64, string, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, "", err
	}
	defer tx.Rollback(ctx)

	var id int64
	var uuid string
	if err := tx.QueryRow(ctx,
		`INSERT INTO dndshare."session" (owner_user_id, name, description, system_id, invite_code, status)
		 VALUES ($1, $2, $3, $4, $5, 'draft') RETURNING id, uuid::text`,
		userID, name, description, systemID, generateInviteCode(),
	).Scan(&id, &uuid); err != nil {
		return 0, "", err
	}

	var chapterID int64
	if err := tx.QueryRow(ctx,
		`INSERT INTO dndshare.session_chapter (session_id, number, name)
		 VALUES ($1, (SELECT COALESCE(MAX(number), 0) + 1 FROM dndshare.session_chapter WHERE session_id = $1), $2)
		 RETURNING id`,
		id, "Вступление",
	).Scan(&chapterID); err != nil {
		return 0, "", err
	}

	if _, err := tx.Exec(ctx,
		`UPDATE dndshare."session" SET current_chapter_id = $1, changed_at = now() WHERE id = $2`,
		chapterID, id,
	); err != nil {
		return 0, "", err
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, "", err
	}
	return id, uuid, nil
}

// UpdateSession меняет имя и описание сессии (порт updateSession).
func (s *Store) UpdateSession(ctx context.Context, uuid, name string, description *string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare."session" SET name = $2, description = $3, changed_at = now()
		 WHERE uuid = $1::uuid AND deleted = false`,
		uuid, name, description,
	)
	return err
}

// UpdateSessionStatus меняет статус сессии (порт updateSessionStatus).
func (s *Store) UpdateSessionStatus(ctx context.Context, uuid, status string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare."session" SET status = $2, changed_at = now()
		 WHERE uuid = $1::uuid AND deleted = false`,
		uuid, status,
	)
	return err
}

// UpdateCurrentChapter выставляет текущую главу сессии (порт updateCurrentChapter).
func (s *Store) UpdateCurrentChapter(ctx context.Context, uuid string, chapterID *int64) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare."session" SET current_chapter_id = $2, changed_at = now()
		 WHERE uuid = $1::uuid AND deleted = false`,
		uuid, chapterID,
	)
	return err
}

// DeleteGameSession помечает сессию удалённой (порт deleteSession).
func (s *Store) DeleteGameSession(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare."session" SET deleted = true WHERE id = $1`, id)
	return err
}

// AddSessionParticipant добавляет персонажа в сессию (порт addParticipant).
func (s *Store) AddSessionParticipant(ctx context.Context, sessionID, charID, userID int64) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO dndshare.session_participant (session_id, char_id, user_id)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (session_id, char_id) DO NOTHING`,
		sessionID, charID, userID,
	)
	return err
}

// RemoveSessionParticipant убирает участника по пользователю (порт removeParticipant).
func (s *Store) RemoveSessionParticipant(ctx context.Context, sessionID, userID int64) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM dndshare.session_participant WHERE session_id = $1 AND user_id = $2`,
		sessionID, userID,
	)
	return err
}

// RemoveSessionParticipantByCharID убирает участника по персонажу (порт removeParticipantByCharId).
func (s *Store) RemoveSessionParticipantByCharID(ctx context.Context, sessionID, charID int64) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM dndshare.session_participant WHERE session_id = $1 AND char_id = $2`,
		sessionID, charID,
	)
	return err
}

// GetChaptersBySession — главы сессии по порядку (порт SessionChapterRepository.getBySession).
func (s *Store) GetChaptersBySession(ctx context.Context, sessionID int64) ([]SessionChapter, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, session_id, number, name FROM dndshare.session_chapter
		 WHERE session_id = $1 ORDER BY number`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SessionChapter
	for rows.Next() {
		var c SessionChapter
		if err := rows.Scan(&c.ID, &c.SessionID, &c.Number, &c.Name); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// GetChapterByID — глава по id (ErrNotFound, если нет).
func (s *Store) GetChapterByID(ctx context.Context, id int64) (SessionChapter, error) {
	var c SessionChapter
	err := s.pool.QueryRow(ctx,
		`SELECT id, session_id, number, name FROM dndshare.session_chapter WHERE id = $1`, id,
	).Scan(&c.ID, &c.SessionID, &c.Number, &c.Name)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionChapter{}, ErrNotFound
	}
	return c, err
}

// CreateChapter создаёт главу со следующим номером (порт SessionChapterRepository.create).
func (s *Store) CreateChapter(ctx context.Context, sessionID int64, name string) (SessionChapter, error) {
	var c SessionChapter
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.session_chapter (session_id, number, name)
		 VALUES ($1, (SELECT COALESCE(MAX(number), 0) + 1 FROM dndshare.session_chapter WHERE session_id = $1), $2)
		 RETURNING id, session_id, number, name`,
		sessionID, name,
	).Scan(&c.ID, &c.SessionID, &c.Number, &c.Name)
	return c, err
}

// RenameChapter переименовывает главу (порт SessionChapterRepository.rename).
func (s *Store) RenameChapter(ctx context.Context, id int64, name string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.session_chapter SET name = $2 WHERE id = $1`, id, name)
	return err
}

// GetEncounterData возвращает последний активный энкаунтер сессии как JSON-строку
// или nil, если его нет (порт SessionEncounterRepository.getEncounterData).
func (s *Store) GetEncounterData(ctx context.Context, sessionID int64) (*string, error) {
	var data *string
	err := s.pool.QueryRow(ctx,
		`SELECT data::text FROM dndshare.session_encounter
		 WHERE session_id = $1 AND deleted = false ORDER BY id DESC LIMIT 1`,
		sessionID,
	).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return data, err
}

// SaveEncounterData обновляет последний энкаунтер или создаёт новый (порт saveEncounterData).
func (s *Store) SaveEncounterData(ctx context.Context, sessionID int64, status string, round int, data string) error {
	var existing int64
	err := s.pool.QueryRow(ctx,
		`SELECT id FROM dndshare.session_encounter
		 WHERE session_id = $1 AND deleted = false ORDER BY id DESC LIMIT 1`,
		sessionID,
	).Scan(&existing)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if errors.Is(err, pgx.ErrNoRows) {
		_, err = s.pool.Exec(ctx,
			`INSERT INTO dndshare.session_encounter (session_id, status, round, data)
			 VALUES ($1, $2, $3, CAST($4 AS jsonb))`,
			sessionID, status, round, data,
		)
		return err
	}
	_, err = s.pool.Exec(ctx,
		`UPDATE dndshare.session_encounter SET status = $2, round = $3, data = CAST($4 AS jsonb), changed_at = now()
		 WHERE id = $1`,
		existing, status, round, data,
	)
	return err
}

// GetMusicStateData возвращает состояние плеера сессии как JSON-строку или nil
// (порт SessionMusicStateRepository.getStateData).
func (s *Store) GetMusicStateData(ctx context.Context, sessionID int64) (*string, error) {
	var data *string
	err := s.pool.QueryRow(ctx,
		`SELECT data::text FROM dndshare.session_music_state WHERE session_id = $1`,
		sessionID,
	).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return data, err
}

// SaveMusicStateData сохраняет состояние плеера (upsert по session_id, порт saveStateData).
func (s *Store) SaveMusicStateData(ctx context.Context, sessionID int64, data string) error {
	var existing int64
	err := s.pool.QueryRow(ctx,
		`SELECT id FROM dndshare.session_music_state WHERE session_id = $1`, sessionID,
	).Scan(&existing)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	if errors.Is(err, pgx.ErrNoRows) {
		_, err = s.pool.Exec(ctx,
			`INSERT INTO dndshare.session_music_state (session_id, data) VALUES ($1, CAST($2 AS jsonb))`,
			sessionID, data,
		)
		return err
	}
	_, err = s.pool.Exec(ctx,
		`UPDATE dndshare.session_music_state SET data = CAST($2 AS jsonb), changed_at = now() WHERE id = $1`,
		existing, data,
	)
	return err
}

// IsCharOwnedBy — принадлежит ли персонаж пользователю (порт CharacterRepository.isOwnedBy).
func (s *Store) IsCharOwnedBy(ctx context.Context, charID, userID int64) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM dndshare."char" WHERE id = $1 AND user_id = $2 AND deleted = false)`,
		charID, userID,
	).Scan(&exists)
	return exists, err
}

// GetMusicTrackFileKey возвращает file_key и владельца трека (для выдачи ссылки на трек
// сессии, порт части MusicLibraryRepository.getTrackById). ErrNotFound, если трека нет.
func (s *Store) GetMusicTrackFileKey(ctx context.Context, trackID int64) (fileKey string, ownerUserID int64, err error) {
	err = s.pool.QueryRow(ctx,
		`SELECT file_key, owner_user_id FROM dndshare.music_track WHERE id = $1`, trackID,
	).Scan(&fileKey, &ownerUserID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", 0, ErrNotFound
	}
	return fileKey, ownerUserID, err
}

func generateInviteCode() string {
	const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	const digits = "0123456789"
	var b strings.Builder
	for i := 0; i < 5; i++ {
		b.WriteByte(letters[rand.Intn(len(letters))])
	}
	b.WriteByte('-')
	for i := 0; i < 5; i++ {
		b.WriteByte(digits[rand.Intn(len(digits))])
	}
	return b.String()
}
